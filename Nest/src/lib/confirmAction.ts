import { Alert, Platform } from "react-native";

type ConfirmActionOptions = {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * Show a confirmation that works on both React Native and React Native Web.
 * React Native Web does not reliably support Alert.alert button callbacks, so
 * web uses the browser's blocking confirmation dialog instead.
 */
export function confirmAction({
  title,
  message,
  confirmText,
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmActionOptions) {
  if (Platform.OS === "web") {
    if (globalThis.confirm(`${title}\n\n${message}`)) void onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: "cancel" },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: () => void onConfirm(),
    },
  ]);
}
