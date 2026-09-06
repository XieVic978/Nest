import { type PropsWithChildren } from "react";
import { Keyboard, Platform, TouchableWithoutFeedback, View } from "react-native";

/** Dismisses the software keyboard when a person taps an unused part of a screen. */
export function KeyboardDismissView({ children }: PropsWithChildren) {
  // Desktop browsers manage focus with mouse clicks. Wrapping the page in a
  // touch dismiss handler can blur an input during the same click that focuses it.
  if (Platform.OS === "web") return <View style={{ flex: 1 }}>{children}</View>;

  return <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}><View style={{ flex: 1 }}>{children}</View></TouchableWithoutFeedback>;
}
