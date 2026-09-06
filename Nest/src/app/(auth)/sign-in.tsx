import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { validateEmail } from "@/auth/validation";
import { FormField } from "@/components/FormField";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";

// Passwordless sign-in via a six-digit email code. Verifying the code creates
// the Supabase session and sends first-time users to profile setup.
type Step = "email" | "code";

export default function SignIn() {
  const { sendEmailOtp, verifyEmailOtp, signInWithGoogle } = useSession();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSendCode() {
    const emailError = validateEmail(email);
    setErrors({ email: emailError ?? undefined });
    setFormError(null);
    setFormMessage(null);
    if (emailError) return;

    setSubmitting(true);
    const result = await sendEmailOtp(email);
    setSubmitting(false);
    if (result.ok) {
      setStep("code");
    } else {
      setFormError(result.error);
    }
  }

  async function handleVerifyCode() {
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: "Enter the six-digit code from your email." });
      return;
    }

    setErrors({});
    setFormError(null);
    setFormMessage(null);
    setSubmitting(true);
    const result = await verifyEmailOtp(email, code);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
    }
    // On success, the root navigator redirects to profile setup or the Nest.
  }

  async function handleResend() {
    setFormError(null);
    setFormMessage(null);
    setErrors({});
    setSubmitting(true);
    const result = await sendEmailOtp(email);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setCode("");
    setFormMessage("A new code was sent.");
  }

  async function handleGoogle() {
    setFormError(null);
    setFormMessage(null);
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
          ? "Enter your email and we'll send you a secure six-digit code."
          : `Enter the six-digit code we sent to ${email}.`
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
            title="Send sign-in code"
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
            label="6-digit code"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, "").slice(0, 6));
              if (errors.code) setErrors({});
            }}
            error={errors.code}
            autoComplete="one-time-code"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            placeholder="123456"
            returnKeyType="done"
            onSubmitEditing={handleVerifyCode}
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          {formMessage ? <Text style={styles.formMessage}>{formMessage}</Text> : null}

          <PrimaryButton
            title="Verify code"
            onPress={handleVerifyCode}
            loading={submitting}
          />

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleResend}
            style={styles.resend}
          >
            <Text style={styles.link}>Send a new code</Text>
          </Pressable>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep("email");
                setCode("");
                setErrors({});
                setFormError(null);
                setFormMessage(null);
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
  formMessage: { color: "#28634E", fontSize: 14, marginBottom: 14 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  line: { flex: 1, height: 1, backgroundColor: "#d2d6dc" },
  dividerText: { marginHorizontal: 12, color: "#6b7280", fontSize: 13 },
  googleButton: { backgroundColor: "#4b5563" },
  resend: { alignItems: "center", marginTop: 18 },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  link: { color: "#2f6fed", fontSize: 14, fontWeight: "600" },
});
