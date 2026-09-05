import { Tabs } from "expo-router";
const tabOptions = (title: string) => ({ title, tabBarLabel: title, tabBarActiveTintColor: "#28634E", tabBarInactiveTintColor: "#758079" });

export default function RoomLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { height: 70, paddingTop: 7, backgroundColor: "#FFFFFF", borderTopColor: "#E4E8E3" }, tabBarLabelStyle: { fontSize: 11, fontWeight: "800" } }}>
    <Tabs.Screen name="chores" options={tabOptions("Chores")} />
    <Tabs.Screen name="payments" options={tabOptions("Payments")} />
    <Tabs.Screen name="index" options={tabOptions("Nest")} />
    <Tabs.Screen name="groceries" options={tabOptions("Groceries")} />
    <Tabs.Screen name="documents" options={tabOptions("Documents")} />
  </Tabs>;
}
