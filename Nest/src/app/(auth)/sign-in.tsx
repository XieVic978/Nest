import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { validateEmail } from "@/auth/validation";
import { FormField } from "@/components/FormField";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";

// Passwordless sign-in via email link. The link returns to the app, establishes
// the Supabase session, and sends first-time users to profile setup.
type Step = "email" | "sent";

export default function SignIn() {
  const { sendMagicLink, signInWithGoogle } = useSession();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSendLink() {
    const emailError = validateEmail(email);
    setErrors({ email: emailError ?? undefined });
    setFormError(null);
    if (emailError) return;

    setSubmitting(true);
    const result = await sendMagicLink(email);
    setSubmitting(false);
    if (result.ok) {
      setStep("sent");
    } else {
      setFormError(result.error);
    }
  }

  async function handleResend() {
    setFormError(null);
    setErrors({});
    setSubmitting(true);
    const result = await sendMagicLink(email);
    setSubmitting(false);
    if (!result.ok) setFormError(result.error);
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
          ? "Enter your email and we'll send you a secure sign-in link."
          : `We sent a sign-in link to ${email}. Open it on this device to continue.`
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
            title="Send sign-in link"
            onPress={handleSendLink}
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
          <Text style={styles.instructions}>
            Tap the link in the email. Nest will open automatically and take
            you to profile setup if this is your first sign-in.
          </Text>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <PrimaryButton
            title="Send link again"
            onPress={handleResend}
            loading={submitting}
          />

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStep("email");
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
  instructions: {
    color: "#374151",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  line: { flex: 1, height: 1, backgroundColor: "#d2d6dc" },
  dividerText: { marginHorizontal: 12, color: "#6b7280", fontSize: 13 },
  googleButton: { backgroundColor: "#4b5563" },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  link: { color: "#2f6fed", fontSize: 14, fontWeight: "600" },
});
