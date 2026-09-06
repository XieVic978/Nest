import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSession } from "@/auth/ctx";
import type { User } from "@/auth/types";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

import { RoomError, toRoomError } from "./errors";
import { inviteValueFromInput } from "./invite";
import type { JoinResult, RoomInvite, RoomSnapshot } from "./types";

type RoomContextValue = {
  activeInvite: RoomInvite | null;
  configurationReady: boolean;
  createRoom: (name: string) => Promise<void>;
  error: string | null;
  joinRoom: (invite: string, confirmLeave?: boolean) => Promise<JoinResult>;
  loading: boolean;
  pendingInvite: string | null;
  clearPendingInvite: () => void;
  refresh: () => Promise<void>;
  regenerateInvite: () => Promise<RoomInvite>;
  removeMember: (userId: string) => Promise<void>;
  room: RoomSnapshot | null;
  rememberInvite: (invite: string) => void;
  transferAdmin: (userId: string) => Promise<void>;
  user: User | null;
};

const RoomContext = createContext<RoomContextValue | null>(null);

function getDisplayName(user: User): string {
  if (user.profile?.fullName.trim()) return user.profile.fullName.trim();

  throw new RoomError(
    "Finish setting your display name before continuing.",
    "display_name_required",
  );
}

function normalizeSnapshot(value: unknown): RoomSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as RoomSnapshot;
}

function normalizeInvite(value: unknown): RoomInvite | null {
  if (!value || typeof value !== "object") return null;
  return value as RoomInvite;
}

export function RoomProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [activeInvite, setActiveInvite] = useState<RoomInvite | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRoom(null);
      setActiveInvite(null);
      setError(
        "Supabase is not configured yet. Add the Expo public Supabase URL and publishable key.",
      );
      setLoading(false);
      return;
    }

    if (!user) {
      setRoom(null);
      setActiveInvite(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      const client = getSupabaseClient();
      const { data, error: roomError } = await client.rpc("get_my_nest");
      if (roomError) throw roomError;

      const snapshot = normalizeSnapshot(data);
      setRoom(snapshot);
      setError(null);

      if (snapshot?.membership.role === "admin") {
        const { data: inviteData, error: inviteError } = await client.rpc(
          "get_active_nest_invite",
          { p_room_id: snapshot.room.id },
        );
        if (inviteError) throw inviteError;
        setActiveInvite(normalizeInvite(inviteData));
      } else {
        setActiveInvite(null);
      }
    } catch (caught) {
      const roomError = toRoomError(caught);
      setRoom(null);
      setActiveInvite(null);
      setError(roomError.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!room || !isSupabaseConfigured) return;

    const client = getSupabaseClient();
    const channel = client
      .channel(`nest-members-${room.room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${room.room.id}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, room?.room.id]);

  const requireUser = useCallback(() => {
    if (!user) {
      throw new RoomError(
        "Please sign in before continuing.",
        "authentication_required",
      );
    }
    return user;
  }, [user]);

  const createRoom = useCallback(
    async (name: string) => {
      const currentUser = requireUser();
      const client = getSupabaseClient();
      const { data, error: createError } = await client.rpc("create_nest", {
        p_display_name: getDisplayName(currentUser),
        p_name: name.trim(),
      });
      if (createError) throw toRoomError(createError);

      const result = data as { invite?: RoomInvite } | null;
      setActiveInvite(result?.invite ?? null);
      await refresh();
      if (result?.invite) setActiveInvite(result.invite);
    },
    [refresh, requireUser],
  );

  const joinRoom = useCallback(
    async (invite: string, confirmLeave = false) => {
      const currentUser = requireUser();
      const client = getSupabaseClient();
      const normalizedInvite = inviteValueFromInput(invite);
      if (!normalizedInvite) {
        throw new RoomError(
          "Enter an invite link or code.",
          "invalid_invite",
        );
      }

      const { data, error: joinError } = await client.rpc("join_nest", {
        p_confirm_leave: confirmLeave,
        p_display_name: getDisplayName(currentUser),
        p_invite: normalizedInvite,
      });
      if (joinError) throw toRoomError(joinError);

      const result = data as JoinResult;
      if (result.status === "joined" || result.status === "already_member") {
        setPendingInvite(null);
        await refresh();
      }
      return result;
    },
    [refresh, requireUser],
  );

  const regenerateInvite = useCallback(async () => {
    if (!room) throw new RoomError("You do not belong to a Nest.");
    const client = getSupabaseClient();
    const { data, error: inviteError } = await client.rpc(
      "regenerate_nest_invite",
      { p_room_id: room.room.id },
    );
    if (inviteError) throw toRoomError(inviteError);
    const invite = normalizeInvite(data);
    if (!invite) throw new RoomError("The new invitation could not be created.");
    setActiveInvite(invite);
    return invite;
  }, [room]);

  const removeMember = useCallback(
    async (userId: string) => {
      if (!room) throw new RoomError("You do not belong to a Nest.");
      const client = getSupabaseClient();
      const { error: removeError } = await client.rpc("remove_nest_member", {
        p_room_id: room.room.id,
        p_user_id: userId,
      });
      if (removeError) throw toRoomError(removeError);
      await refresh();
    },
    [refresh, room],
  );

  const transferAdmin = useCallback(
    async (userId: string) => {
      if (!room) throw new RoomError("You do not belong to a Nest.");
      const client = getSupabaseClient();
      const { error: transferError } = await client.rpc("transfer_nest_admin", {
        p_new_admin_id: userId,
        p_room_id: room.room.id,
      });
      if (transferError) throw toRoomError(transferError);
      await refresh();
    },
    [refresh, room],
  );

  const value = useMemo<RoomContextValue>(
    () => ({
      activeInvite,
      clearPendingInvite: () => setPendingInvite(null),
      configurationReady: isSupabaseConfigured,
      createRoom,
      error,
      joinRoom,
      loading,
      pendingInvite,
      refresh,
      regenerateInvite,
      removeMember,
      room,
      rememberInvite: setPendingInvite,
      transferAdmin,
      user,
    }),
    [
      activeInvite,
      createRoom,
      error,
      joinRoom,
      loading,
      pendingInvite,
      refresh,
      regenerateInvite,
      removeMember,
      room,
      transferAdmin,
      user,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);
  if (!context) throw new Error("useRoom must be used inside RoomProvider.");
  return context;
}
