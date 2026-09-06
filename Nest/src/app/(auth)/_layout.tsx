import { Stack } from "expo-router";

// Authentication screens use email/password credentials and in-app email codes.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
