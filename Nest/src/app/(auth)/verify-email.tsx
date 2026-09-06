import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useSession } from "@/auth/ctx";
import { validatePassword } from "@/auth/validation";
import { FormField } from "@/components/FormField";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";

export default function VerifyEmail() {
  const { email = "", purpose = "signup" } = useLocalSearchParams<{ email?: string; purpose?: "signup" | "recovery" }>();
  const { verifyEmailCode, resendVerificationCode, resetPasswordWithCode } = useSession();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRecovery = purpose === "recovery";

  async function handleVerify() {
    if (!/^\d{6}(\d{2})?$/.test(code.trim())) {
      return setFormError("Enter the 6- or 8-digit code from your email.");
    }
    if (isRecovery) {
      const passwordError = validatePassword(newPassword);
      if (passwordError) return setFormError(passwordError);
      if (newPassword !== confirmPassword) return setFormError("Passwords do not match.");
    }
    setFormError(null);
    setSubmitting(true);
    const result = isRecovery ? await resetPasswordWithCode(email, code, newPassword) : await verifyEmailCode(email, code);
    setSubmitting(false);
    if (!result.ok) setFormError(result.error);
  }

  async function handleResend() {
    setNotice(null);
    setFormError(null);
    setSubmitting(true);
    const result = await resendVerificationCode(email);
    setSubmitting(false);
    if (!result.ok) return setFormError(result.error);
    setNotice("A fresh code is on its way.");
  }

  return (
    <FormScreen title={isRecovery ? "Enter your reset code" : "Check your email"} subtitle={`Enter the 6- or 8-digit code sent to ${email}. Check Spam if it is not in your inbox; no browser link is needed.`}>
      <FormField label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={8} placeholder="123456" />
      {isRecovery ? <><FormField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" /><FormField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="Enter it again" /></> : null}
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <PrimaryButton title={isRecovery ? "Reset password" : "Verify email"} onPress={handleVerify} loading={submitting} />
      {!isRecovery ? <Pressable style={styles.resend} onPress={handleResend} disabled={submitting}><Text style={styles.link}>Send a new code</Text></Pressable> : null}
      <Pressable style={styles.back} onPress={() => router.replace("/(auth)/sign-in")}><Text style={styles.backText}>Use a different email</Text></Pressable>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#B95048", fontSize: 14, marginBottom: 14 },
  notice: { color: "#2D6C6A", fontSize: 14, marginBottom: 14 },
  resend: { alignItems: "center", marginTop: 20 },
  back: { alignItems: "center", marginTop: 16 },
  link: { color: "#4975A8", fontSize: 14, fontWeight: "800" },
  backText: { color: "#6B7785", fontSize: 14, fontWeight: "700" },
});
