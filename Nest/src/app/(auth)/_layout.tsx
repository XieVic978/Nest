import { Stack } from "expo-router";

// Onboarding/auth stack. Email sign-in links are requested from `sign-in`.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
