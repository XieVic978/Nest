import { type PropsWithChildren } from "react";
import { Keyboard, TouchableWithoutFeedback, View } from "react-native";

/** Dismisses the software keyboard when a person taps an unused part of a screen. */
export function KeyboardDismissView({ children }: PropsWithChildren) {
  return <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}><View style={{ flex: 1 }}>{children}</View></TouchableWithoutFeedback>;
}
