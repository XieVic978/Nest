// Shared scaffold for auth/profile forms: safe area, keyboard avoidance,
// scrollable content, and a title/subtitle header. Minimal styling for now.

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardDismissView } from "@/components/KeyboardDismissView";

interface FormScreenProps extends ViewProps {
  title: string;
  subtitle?: string;
}

export function FormScreen({
  title,
  subtitle,
  children,
  ...rest
}: FormScreenProps) {
  return (
    <KeyboardDismissView><SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header} {...rest}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView></KeyboardDismissView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginTop: 8,
    lineHeight: 21,
  },
});
