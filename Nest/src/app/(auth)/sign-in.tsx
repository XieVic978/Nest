import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { validateEmail, validateOtpCode } from "@/auth/validation";
import { FormField } from "@/components/FormField";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";

// Passwordless sign-in via email OTP. Step 1 sends a code to the email; step 2
// verifies it. The same flow signs in returning users and creates accounts for
// new emails. On success the root navigator routes onward automatically.
type Step = "email" | "code";

export default function SignIn() {
  const { sendOtp, verifyOtp, signInWithGoogle } = useSession();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSendCode() {
    const emailError = validateEmail(email);
    setErrors({ email: emailError ?? undefined });
    setFormError(null);
    if (emailError) return;

    setSubmitting(true);
    const result = await sendOtp(email);
    setSubmitting(false);
    if (result.ok) {
      setStep("code");
    } else {
      setFormError(result.error);
    }
  }

  async function handleVerify() {
    const codeError = validateOtpCode(code);
    setErrors({ code: codeError ?? undefined });
    setFormError(null);
    if (codeError) return;

    setSubmitting(true);
    const result = await verifyOtp(email, code);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
    }
    // On success, the root navigator redirects automatically.
  }

  async function handleResend() {
    setFormError(null);
    setCode("");
    setErrors({});
    await sendOtp(email);
  }

  async function handleGoogle() {
    setFormError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);
    if (!result.ok) {
      setFormError(result.error);
    }
    // On success, the root navigator redirects automatically.
  }

  return (
    <FormScreen
      title="Sign in to Nest"
      subtitle={
        step === "email"
          ? "Enter your email and we'll send you a one-time code."
          : `Enter the 6-digit code we sent to ${email}.`
      }
    >
      {step === "email" ? (
        <>
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <PrimaryButton
            title="Send code"
            onPress={handleSendCode}
            loading={submitting}
            disabled={googleLoading}
          />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.line} />
          </View>

          <PrimaryButton
            title="Sign in with Google"
            onPress={handleGoogle}
            loading={googleLoading}
            disabled={submitting}
            style={styles.googleButton}
          />
        </>
      ) : (
        <>
          <FormField
            label="Verification code"
            value={code}
            onChangeText={setCode}
            error={errors.code}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            placeholder="123456"
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <PrimaryButton
            title="Verify and continue"
            onPress={handleVerify}
            loading={submitting}
          />

          <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={handleResend}>
              <Text style={styles.link}>Resend code</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep("email");
                setCode("");
                setErrors({});
                setFormError(null);
              }}
            >
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </View>
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  formError: { color: "#d64545", fontSize: 14, marginBottom: 14 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  line: { flex: 1, height: 1, backgroundColor: "#d2d6dc" },
  dividerText: { marginHorizontal: 12, color: "#6b7280", fontSize: 13 },
  googleButton: { backgroundColor: "#4b5563" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  link: { color: "#2f6fed", fontSize: 14, fontWeight: "600" },
});
