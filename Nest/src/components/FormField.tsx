// Labeled text input with inline error message, used across auth + profile forms.
// Styling is intentionally minimal — the UI/UX pass will restyle these later.

import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function FormField({ label, error, style, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
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
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2933",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d2d6dc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2933",
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#d64545",
  },
  error: {
    marginTop: 6,
    color: "#d64545",
    fontSize: 13,
  },
});
