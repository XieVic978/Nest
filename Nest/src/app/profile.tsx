import { router, type Href } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { toRoomError } from "@/features/rooms/errors";
import { useRoom } from "@/features/rooms/RoomProvider";

// Typed as Href because the generated route types don't always include the
// bare (room) group-index path.
const ROOM_HOME = "/(room)" as Href;

export default function ProfileScreen() {
  const { user, signOut } = useSession();
  const { leaveNest, room } = useRoom();
  const confirmLeave = () => Alert.alert("Leave this Nest?", "You will lose access to this Nest's shared information. You can join another Nest later with its code.", [{ text: "Cancel", style: "cancel" }, { text: "Leave Nest", style: "destructive", onPress: () => void leaveNest().catch((error) => Alert.alert("Could not leave Nest", toRoomError(error).message)) }]);

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

      {room ? <Pressable accessibilityRole="button" onPress={confirmLeave} style={styles.leave}><Text style={styles.leaveText}>Leave Nest</Text></Pressable> : null}

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
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
  leave: { alignSelf: "flex-start", marginTop: 24, borderColor: "#C1443B", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  leaveText: { color: "#C1443B", fontWeight: "800" },
});
