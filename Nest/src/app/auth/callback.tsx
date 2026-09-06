import { useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { FormScreen } from "@/components/FormScreen";
import { PrimaryButton } from "@/components/PrimaryButton";

export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const { completeMagicLink } = useSession();
  const handledUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;

    void (async () => {
      const result = await completeMagicLink(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace(result.user.profile ? "/create-join" : "/profile-setup");
    })();
  }, [completeMagicLink, url]);

  if (error) {
    return (
      <FormScreen
        title="Sign-in link didn't work"
        subtitle={error}
      >
        <PrimaryButton
          title="Request a new link"
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </FormScreen>
    );
  }

  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#28634E" size="large" />
      <Text style={styles.message}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F5EF",
  },
  message: {
    color: "#374151",
    fontSize: 15,
    marginTop: 14,
  },
});
