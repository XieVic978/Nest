import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { useSession } from "@/auth/ctx";
import { validateEmail, validatePassword } from "@/auth/validation";
import { FormField } from "@/components/FormField";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";

type Mode = "login" | "signup" | "reset";

export default function SignIn() {
  const { signInWithPassword, signUp, sendPasswordResetCode } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isReset = mode === "reset";
  const isSignUp = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setFormError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit() {
    const emailError = validateEmail(email);
    const passwordError = isReset ? null : validatePassword(password);
    if (emailError || passwordError) {
      setFormError(emailError ?? passwordError);
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setFormError(null);
    setSubmitting(true);
    if (isReset) {
      const result = await sendPasswordResetCode(email);
      setSubmitting(false);
      if (!result.ok) return setFormError(result.error);
      router.push({ pathname: "/(auth)/verify-email", params: { email, purpose: "recovery" } });
      return;
    }
    if (isSignUp) {
      const result = await signUp(email, password);
      setSubmitting(false);
      if (!result.ok) return setFormError(result.error);
      router.push({ pathname: "/(auth)/verify-email", params: { email, purpose: "signup" } });
      return;
    }
    const result = await signInWithPassword(email, password);
    setSubmitting(false);
    if (!result.ok) setFormError(result.error);
  }

  return (
    <FormScreen
      title={isSignUp ? "Create your Nest account" : isReset ? "Reset your password" : "Welcome back to Nest"}
      subtitle={isSignUp ? "Use an email and password. We’ll email a code for you to enter here." : isReset ? "We’ll email a code so you can securely choose a new password." : "Log in to get back to your Nest."}
    >
      <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" />
      {!isReset ? (
        <>
          <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={isSignUp ? "new-password" : "current-password"} textContentType={isSignUp ? "newPassword" : "password"} placeholder="At least 8 characters" />
          {isSignUp ? <FormField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="Enter it again" /> : null}
        </>
      ) : null}
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <PrimaryButton title={isSignUp ? "Create account" : isReset ? "Email reset code" : "Log in"} onPress={handleSubmit} loading={submitting} />
      <View style={styles.footer}>
        {mode === "login" ? <><Pressable onPress={() => switchMode("signup")}><Text style={styles.link}>Create an account</Text></Pressable><Pressable onPress={() => switchMode("reset")}><Text style={styles.secondaryLink}>Forgot password?</Text></Pressable></> : <Pressable onPress={() => switchMode("login")}><Text style={styles.link}>Back to log in</Text></Pressable>}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  formError: { color: "#d64545", fontSize: 14, marginBottom: 14 },
  footer: { alignItems: "center", gap: 14, marginTop: 22 },
  link: { color: "#2f6fed", fontSize: 14, fontWeight: "600" },
  secondaryLink: { color: "#59636f", fontSize: 14, fontWeight: "600" },
});
