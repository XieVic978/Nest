import { Redirect } from "expo-router";

// Legacy email links must not establish sessions. Nest now verifies a code the
// user enters inside the app, avoiding invalid localhost redirect URLs.
export default function AuthCallback() {
  return <Redirect href="/(auth)/sign-in" />;
}
