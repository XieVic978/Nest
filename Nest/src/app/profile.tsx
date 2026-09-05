import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  return <View style={styles.screen}><Text style={styles.title}>Profile</Text><Pressable accessibilityRole="button" onPress={() => router.replace("/(room)")} style={styles.button}><Text style={styles.buttonText}>Back to Nest</Text></Pressable></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 }, title: { fontSize: 30, fontWeight: "800", color: "#18251F" }, button: { alignSelf: "flex-start", marginTop: 24, backgroundColor: "#28634E", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }, buttonText: { color: "white", fontWeight: "800" } });
