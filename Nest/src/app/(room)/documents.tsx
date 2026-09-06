import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useRoom } from "@/features/rooms/RoomProvider";

export default function DocumentsScreen() {
  const { nestJoinCode } = useRoom();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  return <View style={styles.screen}><Text style={styles.title}>Documents</Text>{!unlocked ? <><Text style={styles.body}>Enter your four-digit Nest PIN to access shared documents.</Text><TextInput accessibilityLabel="Four digit PIN" keyboardType="number-pad" maxLength={4} onChangeText={setPin} placeholder="4-digit PIN" secureTextEntry style={styles.input} value={pin} /><Pressable disabled={pin.length !== 4} onPress={() => setUnlocked(true)} style={[styles.button, pin.length !== 4 && styles.disabled]}><Text style={styles.buttonText}>Unlock documents</Text></Pressable></> : <><Text style={styles.body}>Shared documents will appear here.</Text><Text style={styles.label}>PERMANENT NEST CODE</Text><Pressable onPress={() => nestJoinCode && void Clipboard.setStringAsync(nestJoinCode)} style={styles.code}><Text style={styles.codeText}>{nestJoinCode ?? "Loading…"}</Text><Text style={styles.copy}>TAP TO COPY</Text></Pressable></>}</View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 }, title: { fontSize: 30, fontWeight: "800", color: "#18251F", marginBottom: 12 }, body: { color: "#64716B", lineHeight: 21, marginBottom: 20 }, input: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 12, padding: 15, fontSize: 16 }, button: { backgroundColor: "#28634E", borderRadius: 12, padding: 15, marginTop: 12, alignItems: "center" }, buttonText: { color: "white", fontWeight: "800" }, disabled: { opacity: .5 }, label: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 20, marginBottom: 7 }, code: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 12, padding: 16 }, codeText: { color: "#18251F", fontSize: 22, fontWeight: "900", letterSpacing: 2 }, copy: { color: "#28634E", fontSize: 10, fontWeight: "800", marginTop: 5 } });
