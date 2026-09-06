import { router, type Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSession } from "@/auth/ctx";
import { toRoomError } from "@/features/rooms/errors";
import { useRoom } from "@/features/rooms/RoomProvider";

// Typed as Href because the generated route types don't always include the
// bare (room) group-index path.
const ROOM_HOME = "/(room)" as Href;

export default function ProfileScreen() {
  const { user, signOut } = useSession();
  const { leaveRoom, room } = useRoom();
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirmationVisible, setLeaveConfirmationVisible] =
    useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const nextAdmin = room?.members
    .filter((member) => member.userId !== user?.id)
    .sort((a, b) => {
      const joinedDifference =
        new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      return joinedDifference || a.userId.localeCompare(b.userId);
    })[0];

  async function runLeave() {
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveRoom();
      setLeaveConfirmationVisible(false);
      router.replace("/create-join");
    } catch (caught) {
      setLeaveError(toRoomError(caught).message);
    } finally {
      setLeaving(false);
    }
  }

  const leaveMessage =
    room?.members.length === 1
      ? "You’re the last member. Leaving will permanently delete this Nest and all of its shared information."
      : room?.membership.role === "admin"
        ? `${nextAdmin?.displayName ?? "The next member"} will become the new admin. Current invitations will be revoked.`
        : "You’ll lose access to this Nest and all of its shared information.";

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace(ROOM_HOME)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Back to Nest</Text>
      </Pressable>

      {room ? (
        <Pressable
          accessibilityRole="button"
          disabled={leaving}
          onPress={() => {
            setLeaveError(null);
            setLeaveConfirmationVisible(true);
          }}
          style={[styles.leave, leaving && styles.disabled]}
        >
          {leaving ? (
            <ActivityIndicator color="#A13D32" />
          ) : (
            <Text style={styles.leaveText}>Leave Nest</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={leaving}
        onPress={signOut}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!leaving) setLeaveConfirmationVisible(false);
        }}
        transparent
        visible={leaveConfirmationVisible}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave this Nest?</Text>
            <Text style={styles.modalBody}>{leaveMessage}</Text>

            {leaveError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {leaveError}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={leaving}
                onPress={() => setLeaveConfirmationVisible(false)}
                style={[styles.cancelButton, leaving && styles.disabled]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={leaving}
                onPress={() => void runLeave()}
                style={[styles.confirmButton, leaving && styles.disabled]}
              >
                {leaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmText}>Leave Nest</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 },
  title: { fontSize: 30, fontWeight: "800", color: "#18251F" },
  email: { marginTop: 8, fontSize: 14, color: "#758079" },
  button: {
    alignSelf: "flex-start",
    marginTop: 24,
    backgroundColor: "#28634E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: { color: "white", fontWeight: "800" },
  leave: {
    alignSelf: "flex-start",
    minWidth: 108,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderColor: "#C1443B",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leaveText: { color: "#C1443B", fontWeight: "800" },
  disabled: { opacity: 0.55 },
  signOut: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderColor: "#C1443B",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signOutText: { color: "#C1443B", fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(12, 25, 18, 0.48)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 20,
    padding: 22,
    backgroundColor: "#FFFFFF",
  },
  modalTitle: { color: "#18251F", fontSize: 22, fontWeight: "900" },
  modalBody: {
    color: "#5E6B65",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  error: { color: "#A13D32", fontSize: 14, lineHeight: 20, marginTop: 14 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#EEF0EC",
  },
  cancelText: { color: "#33443C", fontWeight: "900" },
  confirmButton: {
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#A13D32",
  },
  confirmText: { color: "#FFFFFF", fontWeight: "900" },
});
