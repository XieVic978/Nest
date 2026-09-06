import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardDismissView } from "@/components/KeyboardDismissView";
import { toRoomError } from "@/features/rooms/errors";
import { useRoom } from "@/features/rooms/RoomProvider";
import type { JoinResult } from "@/features/rooms/types";

type Mode = "create" | "join";

export default function CreateJoinScreen() {
  const {
    configurationReady,
    createRoom,
    error: roomError,
    joinRoom,
    loading,
    pendingInvite,
    refresh,
    room,
    user,
  } = useRoom();
  const [mode, setMode] = useState<Mode>("create");
  const [roomName, setRoomName] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<JoinResult | null>(null);

  useEffect(() => {
    if (loading) return;
    if (pendingInvite) {
      router.replace({ pathname: "/join/[invite]", params: { invite: pendingInvite } });
    } else if (room) {
      router.replace("/(room)");
    }
  }, [loading, pendingInvite, room]);

  async function handleCreate() {
    if (!roomName.trim()) {
      setError("Enter a name for your Nest.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createRoom(roomName);
      router.replace("/(room)");
    } catch (caught) {
      setError(toRoomError(caught).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function finishJoin(confirmLeave: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await joinRoom(invite, confirmLeave);
      if (result.status === "switch_required") {
        setSwitchTarget(result);
        return;
      }
      if (result.status === "admin_transfer_required") {
        setError(
          "You are the only admin of your current Nest. Transfer admin access before leaving.",
        );
        return;
      }
      router.replace("/(room)");
    } catch (caught) {
      setError(toRoomError(caught).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#28634E" size="large" /></View>;
  }

  if (!configurationReady) {
    return <View style={styles.center}><Text style={styles.title}>Connect Supabase</Text><Text style={styles.body}>{roomError}</Text></View>;
  }

  if (!user) {
    return <View style={styles.center}><Text style={styles.title}>Sign in first</Text><Text style={styles.body}>You need an authenticated account and display name before creating or joining a Nest.</Text><Pressable onPress={() => router.replace("/(auth)/sign-in")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Go to login</Text></Pressable></View>;
  }

  if (roomError) {
    return <View style={styles.center}><Text style={styles.title}>Couldn’t open your Nest</Text><Text style={styles.body}>{roomError}</Text><Pressable onPress={() => void refresh()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View>;
  }

  return (
    <KeyboardDismissView>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>WELCOME HOME</Text>
        <Text style={styles.title}>Create a new Nest or join a Nest</Text>
        <Text style={styles.body}>Bring your roommates and shared home life into one place.</Text>

        <View accessibilityRole="tablist" style={styles.segmented}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "create" }} onPress={() => { setMode("create"); setError(null); }} style={[styles.segment, mode === "create" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "create" && styles.segmentTextActive]}>Create a new Nest</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "join" }} onPress={() => { setMode("join"); setError(null); }} style={[styles.segment, mode === "join" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "join" && styles.segmentTextActive]}>Join a Nest</Text></Pressable>
        </View>

        <View style={styles.card}>
          {mode === "create" ? (
            <>
              <Text style={styles.cardTitle}>Name your Nest</Text>
              <Text style={styles.label}>Nest name</Text>
              <TextInput accessibilityLabel="Nest name" autoCapitalize="words" enterKeyHint="done" maxLength={60} onChangeText={setRoomName} onSubmitEditing={Keyboard.dismiss} placeholder="Maple Street House" placeholderTextColor="#89938E" style={styles.input} value={roomName} />
              <Text style={styles.helper}>Every roommate has equal access. A permanent code will be available in Documents.</Text>
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void handleCreate()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Create a new Nest</Text>}</Pressable>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Join your roommates</Text>
              <Text style={styles.label}>Permanent Nest code</Text>
              <TextInput accessibilityLabel="Permanent Nest code" autoCapitalize="characters" autoCorrect={false} enterKeyHint="done" onChangeText={setInvite} onSubmitEditing={Keyboard.dismiss} placeholder="ABCDE-FGHIJ" placeholderTextColor="#89938E" style={styles.input} value={invite} />
              <Text style={styles.helper}>Ask any roommate for the 10-letter-and-number code in Documents. The hyphen is optional.</Text>
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void finishJoin(false)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Join a Nest</Text>}</Pressable>
            </>
          )}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>

      <Pressable
        accessibilityLabel="Settings"
        accessibilityRole="button"
        onPress={() => router.push("/profile")}
        style={styles.profileButton}
      >
        <Text style={styles.profileButtonText}>Settings</Text>
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setSwitchTarget(null)} transparent visible={switchTarget?.status === "switch_required"}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave your current Nest?</Text>
            <Text style={styles.body}>Joining {switchTarget?.roomName ?? "this Nest"} will remove you from your current Nest. Are you sure you want to leave?</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setSwitchTarget(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable disabled={submitting} onPress={() => { setSwitchTarget(null); void finishJoin(true); }} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Leave and join</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </KeyboardDismissView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF" },
  profileButton: { position: "absolute", right: 24, top: 54, borderColor: "#28634E", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F7F5EF" },
  profileButtonText: { color: "#28634E", fontSize: 14, fontWeight: "900" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 64 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 28, backgroundColor: "#F7F5EF" },
  eyebrow: { color: "#8B6F47", fontSize: 12, fontWeight: "900", letterSpacing: 1.8, marginBottom: 10 },
  title: { color: "#18251F", fontSize: 34, fontWeight: "900", letterSpacing: -0.8 },
  body: { color: "#5E6B65", fontSize: 16, lineHeight: 23, marginTop: 10 },
  segmented: { flexDirection: "row", marginTop: 30, padding: 4, borderRadius: 14, backgroundColor: "#E9E9E2" },
  segment: { flex: 1, alignItems: "center", borderRadius: 11, paddingVertical: 11 },
  segmentActive: { backgroundColor: "#FFFFFF" },
  segmentText: { color: "#69736E", fontWeight: "800" },
  segmentTextActive: { color: "#28634E" },
  card: { marginTop: 16, padding: 20, borderRadius: 20, backgroundColor: "#FFFFFF", borderColor: "#E4E8E3", borderWidth: 1 },
  cardTitle: { color: "#18251F", fontSize: 21, fontWeight: "900", marginBottom: 20 },
  label: { color: "#33443C", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#D8DED9", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: "#18251F", backgroundColor: "#FAFBF8", fontSize: 16 },
  helper: { color: "#758079", fontSize: 13, lineHeight: 19, marginTop: 10 },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 20, borderRadius: 13, paddingHorizontal: 18, backgroundColor: "#28634E" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.6 },
  error: { color: "#A13D32", fontSize: 14, lineHeight: 20, marginTop: 14 },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(12, 25, 18, 0.48)" },
  modalCard: { width: "100%", maxWidth: 440, borderRadius: 20, padding: 22, backgroundColor: "#FFFFFF" },
  modalTitle: { color: "#18251F", fontSize: 22, fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelButton: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 14, backgroundColor: "#EEF0EC" },
  cancelText: { color: "#33443C", fontWeight: "900" },
  dangerButton: { flex: 1.4, alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 14, backgroundColor: "#A13D32" },
});
