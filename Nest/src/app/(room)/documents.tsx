import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export default function DocumentsScreen() {
  const [pin, setPin] = useState("");
  return <View style={styles.screen}><Text style={styles.title}>Documents</Text><TextInput accessibilityLabel="Four digit PIN" keyboardType="number-pad" maxLength={4} onChangeText={setPin} placeholder="4-digit PIN" secureTextEntry style={styles.input} value={pin} /></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 }, title: { fontSize: 30, fontWeight: "800", color: "#18251F", marginBottom: 20 }, input: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 12, padding: 15, fontSize: 16 } });
