import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { useRoom } from "@/features/rooms/RoomProvider";

export default function AppIndex() {
  const { hasCompletedProfile, isLoading, user } = useSession();
  const { loading: roomLoading, room } = useRoom();

  if (isLoading || (user && hasCompletedProfile && roomLoading)) {
    return <View style={styles.loading}><ActivityIndicator color="#28634E" size="large" /></View>;
  }
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!hasCompletedProfile) return <Redirect href="/profile-setup" />;
  return <Redirect href={room ? "/(room)" : "/create-join"} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F5EF" } });
