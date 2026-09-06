// Shared scaffold for auth/profile forms: safe area, keyboard avoidance,
// scrollable content, and a title/subtitle header. Minimal styling for now.

import {
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardDismissView } from "@/components/KeyboardDismissView";
import { nestTheme } from "@/theme/nest";

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
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}><Text style={styles.eyebrow}>NEST</Text><Text style={styles.title}>{title}</Text></View>
              <Image accessibilityIgnoresInvertColors source={require("../../assets/images/nest/bird-hero.png")} style={styles.bird} />
            </View>
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
    backgroundColor: nestTheme.colors.canvas,
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
    marginBottom: 30,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  titleCopy: { flex: 1, paddingRight: 8 },
  eyebrow: { color: nestTheme.colors.blue, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 },
  bird: { width: 66, height: 66, resizeMode: "contain", marginTop: -9 },
  title: {
    fontFamily: "Georgia",
    fontSize: 34,
    fontWeight: "700",
    color: nestTheme.colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: nestTheme.colors.muted,
    marginTop: 8,
    lineHeight: 21,
  },
});
