import { Stack } from "expo-router";

import { SessionProvider, useSession } from "@/auth/ctx";

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

// Navigation guard state machine:
//   1. Signed out                 -> auth screen (email OTP sign-in)
//   2. Signed in, no profile yet  -> "Welcome to the Nest" profile setup
//   3. Signed in + profile done   -> the (room) experience (room create/join
//                                    lives in the (room) group, owned separately)
function RootNavigator() {
  const { user, hasCompletedProfile } = useSession();
  const isSignedIn = !!user;
  const onboarded = isSignedIn && hasCompletedProfile;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(room)" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && !hasCompletedProfile}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
