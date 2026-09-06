import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Typed as Href because the generated route types don't always include the
// bare (room) group-index path.
const ROOM_HOME = "/(room)" as Href;

export default function ProfileScreen() {
  return <View style={styles.screen}><Text style={styles.title}>Profile</Text><Pressable accessibilityRole="button" onPress={() => router.replace(ROOM_HOME)} style={styles.button}><Text style={styles.buttonText}>Back to Nest</Text></Pressable></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 }, title: { fontSize: 30, fontWeight: "800", color: "#18251F" }, button: { alignSelf: "flex-start", marginTop: 24, backgroundColor: "#28634E", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }, buttonText: { color: "white", fontWeight: "800" } });
