// Primary action button with a loading/disabled state.
// Minimal styling for now; the UI/UX pass will restyle later.

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";

interface PrimaryButtonProps extends Omit<PressableProps, "children"> {
  title: string;
  loading?: boolean;
}

export function PrimaryButton({
  title,
  loading,
  disabled,
  style,
  ...rest
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        isDisabled ? styles.disabled : null,
        state.pressed && !isDisabled ? styles.pressed : null,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#2f6fed",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  pressed: {
    backgroundColor: "#255fd1",
  },
  disabled: {
    backgroundColor: "#9db8f5",
  },
  label: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
