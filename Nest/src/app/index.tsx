import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useRoom } from "@/features/rooms/RoomProvider";

export default function Index() {
  const { loading, room, user } = useRoom();

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#28634E" size="large" /></View>;
  if (!user) return <Redirect href="/login" />;
  if (!room) return <Redirect href="/create-join" />;
  return <Redirect href="/(room)" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F5EF" },
});
