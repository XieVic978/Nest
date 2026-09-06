// Labeled text input with inline error message, used across auth + profile forms.
// Styling is intentionally minimal — the UI/UX pass will restyle these later.

import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { nestTheme } from "@/theme/nest";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function FormField({ label, error, multiline, style, submitBehavior, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        returnKeyType="done"
        multiline={multiline}
        style={[styles.input, error ? styles.inputError : null, style]}
        submitBehavior={submitBehavior ?? (multiline ? "newline" : "blurAndSubmit")}
        placeholderTextColor="#9aa0a6"
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: nestTheme.colors.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: nestTheme.colors.border,
    borderRadius: nestTheme.radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: nestTheme.colors.ink,
    backgroundColor: nestTheme.colors.surface,
  },
  inputError: {
    borderColor: nestTheme.colors.coral,
  },
  error: {
    marginTop: 6,
    color: "#B95048",
    fontSize: 13,
  },
});
