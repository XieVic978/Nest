import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { RoomProvider } from "@/features/rooms/RoomProvider";

export default function RootLayout() {
  return (
    <RoomProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="create-join" />
        <Stack.Screen name="join/[invite]" />
        <Stack.Screen name="(room)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="room-settings" />
      </Stack>
    </RoomProvider>
  );
}
