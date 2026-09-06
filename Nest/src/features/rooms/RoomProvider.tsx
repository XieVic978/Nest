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
import type { JoinResult, RoomSnapshot } from "./types";

type RoomContextValue = {
  configurationReady: boolean;
  createRoom: (name: string) => Promise<void>;
  error: string | null;
  joinRoom: (invite: string, confirmLeave?: boolean) => Promise<JoinResult>;
  leaveNest: () => Promise<void>;
  nestJoinCode: string | null;
  loading: boolean;
  pendingInvite: string | null;
  clearPendingInvite: () => void;
  refresh: () => Promise<void>;
  regenerateJoinCode: () => Promise<string>;
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

export function RoomProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [nestJoinCode, setNestJoinCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRoom(null);
      setNestJoinCode(null);
      setError(
        "Supabase is not configured yet. Add the Expo public Supabase URL and publishable key.",
      );
      setLoading(false);
      return;
    }

    if (!user) {
      setRoom(null);
      setNestJoinCode(null);
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
      const { data: codeData, error: codeError } = await client.rpc("get_nest_join_code");
      if (codeError) throw codeError;
      setNestJoinCode(typeof codeData === "string" ? codeData : null);
      setError(null);

    } catch (caught) {
      const roomError = toRoomError(caught);
      setRoom(null);
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.room.id}`,
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

      void data;
      await refresh();
    },
    [refresh, requireUser],
  );

  const joinRoom = useCallback(
    async (invite: string, _confirmLeave = false) => {
      const currentUser = requireUser();
      const client = getSupabaseClient();
      const normalizedInvite = inviteValueFromInput(invite);
      if (!normalizedInvite) {
        throw new RoomError(
          "Enter an invite link or code.",
          "invalid_invite",
        );
      }

      const { data, error: joinError } = await client.rpc("join_nest_by_code", {
        p_display_name: getDisplayName(currentUser),
        p_code: normalizedInvite,
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

  const leaveNest = useCallback(async () => {
    const client = getSupabaseClient();
    const { error: leaveError } = await client.rpc("leave_nest");
    if (leaveError) throw toRoomError(leaveError);

    // Update local room state before the background refresh so the profile
    // screen can immediately route the member to Create / Join Nest.
    setRoom(null);
    setNestJoinCode(null);
    setError(null);
    void refresh();
  }, [refresh]);

  const regenerateJoinCode = useCallback(async () => {
    if (!room) throw new RoomError("You do not belong to a Nest.");
    const client = getSupabaseClient();
    const { data, error: codeError } = await client.rpc(
      "regenerate_nest_join_code",
    );
    if (codeError) throw toRoomError(codeError);
    if (typeof data !== "string") {
      throw new RoomError("The new Nest code could not be created.");
    }
    setNestJoinCode(data);
    return data;
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
      clearPendingInvite: () => setPendingInvite(null),
      configurationReady: isSupabaseConfigured,
      createRoom,
      error,
      joinRoom,
      leaveNest,
      loading,
      nestJoinCode,
      pendingInvite,
      refresh,
      regenerateJoinCode,
      removeMember,
      room,
      rememberInvite: setPendingInvite,
      transferAdmin,
      user,
    }),
    [
      createRoom,
      error,
      joinRoom,
      leaveNest,
      loading,
      nestJoinCode,
      pendingInvite,
      refresh,
      regenerateJoinCode,
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
