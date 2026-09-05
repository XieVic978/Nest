import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return <View style={styles.screen}><View style={styles.header}><Text style={styles.title}>Nest</Text><Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push("/profile")} style={styles.profileButton}><Text style={styles.profileText}>Profile</Text></Pressable></View></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontSize: 30, fontWeight: "800", color: "#18251F" }, profileButton: { backgroundColor: "#FFFFFF", borderColor: "#E4E8E3", borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }, profileText: { color: "#28634E", fontWeight: "800", fontSize: 13 } });
