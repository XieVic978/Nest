import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { validateFullName, validatePhone } from "@/auth/validation";
import { FormField } from "@/components/FormField";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { confirmAction } from "@/lib/confirmAction";

// Shown after the first successful login, before the app unlocks. Collects the
// identity details roommates need to recognize each other.
export default function ProfileSetup() {
  const { updateProfile, setDocumentPin, signOut } = useSession();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [venmo, setVenmo] = useState("");
  const [zelle, setZelle] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function confirmSignOut() {
    confirmAction({
      title: "Sign out of Nest?",
      message: "Your incomplete profile setup will stay unfinished until you log back in.",
      confirmText: "Sign out",
      destructive: true,
      onConfirm: signOut,
    });
  }

  async function handleSubmit() {
    // Name is required; phone (and Venmo/Zelle) are optional. Phone is only
    // validated for format when the user actually entered something.
    const nameError = validateFullName(fullName);
    const phoneError = validatePhone(phone);
    setErrors({ fullName: nameError ?? undefined, phone: phoneError ?? undefined });
    setFormError(null);
    if (nameError || phoneError) return;
    if (!/^\d{4}$/.test(pin)) {
      setFormError("Choose a four-digit Documents PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setFormError("Your PIN entries do not match.");
      return;
    }

    setSubmitting(true);
    const pinResult = await setDocumentPin(pin);
    if (!pinResult.ok) {
      setSubmitting(false);
      setFormError(pinResult.error);
      return;
    }
    const result = await updateProfile({ fullName, phone, venmo, zelle });
    setSubmitting(false);
    if (!result.ok) setFormError(result.error);
    // On success, the root navigator moves the user into the app.
  }

  return (
    <FormScreen
      title="Welcome to the Nest"
      subtitle="Tell your roommates who you are to finish setting up your account."
    >
      <FormField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={errors.fullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        placeholder="Jordan Diaz"
      />
      <FormField
        label="Phone number (optional)"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="(555) 123-4567"
      />
      <FormField
        label="Venmo username (optional)"
        value={venmo}
        onChangeText={setVenmo}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="@your-venmo"
      />
      <FormField
        label="Zelle username (optional)"
        value={zelle}
        onChangeText={setZelle}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Email, phone, or handle"
      />
      <FormField
        label="Four-digit Documents PIN"
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        placeholder="••••"
      />
      <FormField
        label="Confirm Documents PIN"
        value={confirmPin}
        onChangeText={setConfirmPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        placeholder="••••"
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <PrimaryButton title="Continue" onPress={handleSubmit} loading={submitting} />

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={confirmSignOut}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  formError: { color: "#d64545", fontSize: 14, marginBottom: 14 },
  footer: { alignItems: "center", marginTop: 24 },
  link: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
});
