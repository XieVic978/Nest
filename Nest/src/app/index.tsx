import { Redirect, type Href } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { useRoom } from "@/features/rooms/RoomProvider";

const ROOM_HOME = "/(room)" as Href;

export default function AppIndex() {
  const { hasCompletedProfile, isLoading, user } = useSession();
  const { loading: roomLoading, room } = useRoom();

  if (isLoading || (user && hasCompletedProfile && roomLoading)) {
    return <View style={styles.loading}><ActivityIndicator color="#28634E" size="large" /></View>;
  }
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!hasCompletedProfile) return <Redirect href="/profile-setup" />;
  // The room layout sets Nest home as its initial tab, so this valid group
  // route returns a signed-in member to the home screen.
  return <Redirect href={room ? ROOM_HOME : "/create-join"} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F5EF" } });
