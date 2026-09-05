import { StyleSheet, Text, View } from "react-native";

export default function ChoresScreen() {
  return <View style={styles.screen}><Text style={styles.title}>Chores</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 },
  title: { fontSize: 30, fontWeight: "800", color: "#18251F" },
});
