import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { toRoomError } from "@/features/rooms/errors";
import { useRoom } from "@/features/rooms/RoomProvider";
import type { JoinResult } from "@/features/rooms/types";

export default function JoinInviteScreen() {
  const { invite } = useLocalSearchParams<{ invite: string }>();
  const { configurationReady, joinRoom, loading, user } = useRoom();
  const [error, setError] = useState<string | null>(null);
  const [switchTarget, setSwitchTarget] = useState<JoinResult | null>(null);
  const [joining, setJoining] = useState(false);
  const attempted = useRef(false);

  async function accept(confirmLeave: boolean) {
    if (!invite) {
      setError("This invitation is invalid.");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const result = await joinRoom(invite, confirmLeave);
      if (result.status === "switch_required") {
        setSwitchTarget(result);
      } else if (result.status === "admin_transfer_required") {
        setError("You are the only admin of your current Nest. Transfer admin access before leaving.");
      } else {
        router.replace("/(room)");
      }
    } catch (caught) {
      setError(toRoomError(caught).message);
    } finally {
      setJoining(false);
    }
  }

  useEffect(() => {
    if (loading || !user || attempted.current) return;
    attempted.current = true;
    void accept(false);
  }, [loading, user]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#28634E" size="large" /><Text style={styles.body}>Checking your invitation…</Text></View>;

  if (!configurationReady) return <View style={styles.center}><Text style={styles.title}>Nest isn’t connected yet</Text><Text style={styles.body}>Supabase environment values are required before this invitation can be opened.</Text></View>;

  if (!user) {
    const returnTo = `/join/${encodeURIComponent(invite ?? "")}`;
    return <View style={styles.center}><Text style={styles.title}>You’ve been invited</Text><Text style={styles.body}>Sign in and finish your display name to join this Nest.</Text><Pressable onPress={() => router.replace({ pathname: "/login", params: { returnTo } })} style={styles.primary}><Text style={styles.primaryText}>Continue to login</Text></Pressable></View>;
  }

  return (
    <View style={styles.center}>
      {joining ? <ActivityIndicator color="#28634E" size="large" /> : null}
      <Text style={styles.title}>{error ? "Couldn’t join this Nest" : "Joining your Nest…"}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <Text style={styles.body}>We’re validating the invitation and your membership.</Text>}
      {error ? <Pressable onPress={() => router.replace("/create-join")} style={styles.secondary}><Text style={styles.secondaryText}>Enter a different code</Text></Pressable> : null}

      <Modal animationType="fade" onRequestClose={() => setSwitchTarget(null)} transparent visible={switchTarget?.status === "switch_required"}>
        <View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>Leave your current Nest?</Text><Text style={styles.body}>Joining {switchTarget?.roomName ?? "this Nest"} will remove you from your current Nest. Are you sure you want to leave?</Text><View style={styles.actions}><Pressable onPress={() => { setSwitchTarget(null); router.replace("/(room)"); }} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => { setSwitchTarget(null); void accept(true); }} style={styles.danger}><Text style={styles.primaryText}>Leave and join</Text></Pressable></View></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F7F5EF" },
  title: { color: "#18251F", fontSize: 28, fontWeight: "900", textAlign: "center" },
  modalTitle: { color: "#18251F", fontSize: 22, fontWeight: "900" },
  body: { maxWidth: 430, color: "#5E6B65", fontSize: 16, lineHeight: 23, marginTop: 12, textAlign: "center" },
  error: { maxWidth: 430, color: "#A13D32", fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: "center" },
  primary: { marginTop: 22, borderRadius: 13, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#28634E" },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  secondary: { marginTop: 18, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 13, borderColor: "#28634E", borderWidth: 1 },
  secondaryText: { color: "#28634E", fontWeight: "900" },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(12, 25, 18, 0.48)" },
  modal: { width: "100%", maxWidth: 440, borderRadius: 20, padding: 22, backgroundColor: "#FFFFFF" },
  actions: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancel: { flex: 1, alignItems: "center", borderRadius: 12, padding: 14, backgroundColor: "#EEF0EC" },
  cancelText: { color: "#33443C", fontWeight: "900" },
  danger: { flex: 1.4, alignItems: "center", borderRadius: 12, padding: 14, backgroundColor: "#A13D32" },
});
