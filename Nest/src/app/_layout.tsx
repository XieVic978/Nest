import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { SessionProvider, useSession } from "@/auth/ctx";
import { RoomProvider, useRoom } from "@/features/rooms/RoomProvider";

export default function RootLayout() {
  return (
    <SessionProvider>
      <RoomProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </RoomProvider>
    </SessionProvider>
  );
}

function RootNavigator() {
  const { user, hasCompletedProfile, isLoading } = useSession();
  const { loading: roomLoading, room } = useRoom();
  const isSignedIn = Boolean(user);
  const onboarded = isSignedIn && hasCompletedProfile;

  if (isLoading || (onboarded && roomLoading)) {
    return <View style={styles.loading}><ActivityIndicator color="#4975A8" size="large" /></View>;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboarded && !room}>
        <Stack.Screen name="create-join" />
      </Stack.Protected>

      <Stack.Protected guard={onboarded && Boolean(room)}>
        <Stack.Screen name="(room)" />
        <Stack.Screen name="room-settings" />
      </Stack.Protected>

      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="profile" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && !hasCompletedProfile}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="join/[invite]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFCF5" },
});
