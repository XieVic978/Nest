import { Redirect, type Href } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { useRoom } from "@/features/rooms/RoomProvider";

const ROOM_HOME = "/(room)/index" as Href;

export default function AppIndex() {
  const { hasCompletedProfile, isLoading, user } = useSession();
  const { loading: roomLoading, room } = useRoom();

  if (isLoading || (user && hasCompletedProfile && roomLoading)) {
    return <View style={styles.loading}><ActivityIndicator color="#28634E" size="large" /></View>;
  }
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!hasCompletedProfile) return <Redirect href="/profile-setup" />;
  // A bare tab group opens its first tab (Chores). Route to the group's index
  // screen explicitly so returning members always open their Nest home page.
  return <Redirect href={room ? ROOM_HOME : "/create-join"} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F5EF" } });
