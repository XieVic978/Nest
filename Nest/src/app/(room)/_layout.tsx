import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View, type ColorValue } from "react-native";

import { useRoom } from "@/features/rooms/RoomProvider";
const tabOptions = (title: string, icon: string) => ({
  title,
  tabBarLabel: title.toUpperCase(),
  tabBarActiveTintColor: "#4975A8",
  tabBarInactiveTintColor: "#7E8B98",
  tabBarIcon: ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 21, fontWeight: "700", lineHeight: 22 }}>{icon}</Text>,
});

export const unstable_settings = {
  initialRouteName: "index",
};

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

  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { height: 78, paddingTop: 8, backgroundColor: "#FFFFFF", borderTopColor: "#E4E8E8" }, tabBarItemStyle: { borderRadius: 12, marginHorizontal: 1 }, tabBarLabelStyle: { fontSize: 10, fontWeight: "800", letterSpacing: .2, marginTop: 1 } }}>
    <Tabs.Screen name="chores" options={tabOptions("Chores", "✓")} />
    <Tabs.Screen name="payments" options={tabOptions("Payments", "$ ")} />
    <Tabs.Screen name="index" options={tabOptions("Nest", "⌂")} />
    <Tabs.Screen name="groceries" options={tabOptions("Groceries", "▣")} />
    <Tabs.Screen name="documents" options={tabOptions("Notes", "☷")} />
    <Tabs.Screen name="upload-grocery" options={{ href: null }} />
    <Tabs.Screen name="review-grocery" options={{ href: null }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: "#FFFCF5" },
  status: { color: "#6B7785", fontWeight: "600" },
  error: { color: "#B95048", fontSize: 16, textAlign: "center" },
});
