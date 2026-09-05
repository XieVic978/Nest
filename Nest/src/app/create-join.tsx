import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function CreateJoinScreen() {
  return <View style={styles.screen}><Text style={styles.title}>Create or join a home</Text><Pressable onPress={() => router.replace("/(room)")} style={styles.button}><Text style={styles.buttonText}>Create a home</Text></Pressable><Pressable onPress={() => router.replace("/(room)")} style={styles.secondary}><Text style={styles.secondaryText}>Join a home</Text></Pressable></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F7F5EF" }, title: { fontSize: 30, fontWeight: "800", marginBottom: 24, color: "#18251F" }, button: { backgroundColor: "#28634E", borderRadius: 12, padding: 15, alignItems: "center" }, buttonText: { color: "white", fontWeight: "800" }, secondary: { borderRadius: 12, padding: 15, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: "#28634E" }, secondaryText: { color: "#28634E", fontWeight: "800" } });
