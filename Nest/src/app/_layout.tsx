import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="create-join" />
        <Stack.Screen name="(room)" />
        <Stack.Screen name="profile" />
      </Stack>
    </>
  );
}
