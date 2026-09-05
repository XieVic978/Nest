import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function LoginScreen() {
  return <View style={styles.screen}><Text style={styles.title}>Log in</Text><TextInput accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" placeholder="Email" style={styles.input} /><Pressable onPress={() => router.push("/create-join")} style={styles.button}><Text style={styles.buttonText}>Continue</Text></Pressable></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F7F5EF" }, title: { fontSize: 30, fontWeight: "800", marginBottom: 24, color: "#18251F" }, input: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 12, padding: 15, fontSize: 16 }, button: { backgroundColor: "#28634E", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 12 }, buttonText: { color: "white", fontWeight: "800" } });
