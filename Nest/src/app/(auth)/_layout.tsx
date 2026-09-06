import { Stack } from "expo-router";

// Onboarding/auth stack. A single email OTP flow lives on `sign-in`.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
