import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useRoom } from "@/features/rooms/RoomProvider";
const tabOptions = (title: string) => ({ title, tabBarLabel: title, tabBarActiveTintColor: "#28634E", tabBarInactiveTintColor: "#758079" });

export default function RoomLayout() {
  const { error, loading, room, user } = useRoom();

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#28634E" size="large" /><Text style={styles.status}>Opening your Nest…</Text></View>;
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!room) {
    if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
    return <Redirect href="/create-join" />;
  }

  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { height: 70, paddingTop: 7, backgroundColor: "#FFFFFF", borderTopColor: "#E4E8E3" }, tabBarLabelStyle: { fontSize: 11, fontWeight: "800" } }}>
    <Tabs.Screen name="chores" options={tabOptions("Chores")} />
    <Tabs.Screen name="payments" options={tabOptions("Payments")} />
    <Tabs.Screen name="index" options={tabOptions("Nest")} />
    <Tabs.Screen name="groceries" options={tabOptions("Groceries")} />
    <Tabs.Screen name="documents" options={tabOptions("Documents")} />
  </Tabs>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: "#F7F5EF" },
  status: { color: "#52605A", fontWeight: "600" },
  error: { color: "#A13D32", fontSize: 16, textAlign: "center" },
});
