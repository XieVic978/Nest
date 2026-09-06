import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { validateFullName, validatePhone } from "@/auth/validation";
import { FormField } from "@/components/FormField";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";

// Shown after the first successful login, before the app unlocks. Collects the
// identity details roommates need to recognize each other.
export default function ProfileSetup() {
  const { updateProfile, signOut } = useSession();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [venmo, setVenmo] = useState("");
  const [zelle, setZelle] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    // Name is required; phone (and Venmo/Zelle) are optional. Phone is only
    // validated for format when the user actually entered something.
    const nameError = validateFullName(fullName);
    const phoneError = validatePhone(phone);
    setErrors({ fullName: nameError ?? undefined, phone: phoneError ?? undefined });
    setFormError(null);
    if (nameError || phoneError) return;

    setSubmitting(true);
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

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <PrimaryButton title="Continue" onPress={handleSubmit} loading={submitting} />

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={signOut}>
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
