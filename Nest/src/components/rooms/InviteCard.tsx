import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { toRoomError } from "@/features/rooms/errors";
import { buildInviteLink, formatInviteCode } from "@/features/rooms/invite";

type InviteCardProps = {
  code: string | null;
  onRegenerate: () => Promise<string>;
};

export function InviteCard({ code, onRegenerate }: InviteCardProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formattedCode = code ? formatInviteCode(code) : "";
  const inviteLink = code ? buildInviteLink(code) : "";

  async function copy(value: string, label: string) {
    const copied = await Clipboard.setStringAsync(value);
    setNotice(copied ? `${label} copied.` : `Could not copy the ${label.toLowerCase()}.`);
  }

  async function regenerate() {
    setBusy(true);
    setNotice(null);
    try {
      await onRegenerate();
      setNotice("New permanent code created. The previous code no longer works.");
    } catch (caught) {
      setNotice(toRoomError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  async function shareInvite() {
    if (!code) return;
    await Share.share({
      message: `Join my Nest with code ${formattedCode} or open ${inviteLink}. This code works until a roommate regenerates it.`,
      title: "Join my Nest",
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>ROOMMATE INVITE</Text>
          <Text style={styles.title}>Invite your roommates</Text>
        </View>
      </View>

      {code ? (
        <>
          <Text style={styles.body}>This permanent code works until someone in the Nest regenerates it.</Text>
          <Text style={styles.label}>Permanent Nest code</Text>
          <Pressable accessibilityLabel="Copy permanent Nest code" onPress={() => void copy(formattedCode, "Code")} style={styles.valueRow}>
            <Text selectable style={styles.code}>{formattedCode}</Text>
            <Text style={styles.copy}>COPY</Text>
          </Pressable>
          <Text style={styles.label}>App link</Text>
          <Pressable accessibilityLabel="Copy invite link" onPress={() => void copy(inviteLink, "Link")} style={styles.valueRow}>
            <Text numberOfLines={1} selectable style={styles.link}>{inviteLink}</Text>
            <Text style={styles.copy}>COPY</Text>
          </Pressable>
        </>
      ) : <Text style={styles.body}>Loading the permanent Nest code…</Text>}

      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      <View style={styles.actions}>
        <Pressable disabled={!code || busy} onPress={() => void shareInvite()} style={[styles.primary, (!code || busy) && styles.disabled]}><Text style={styles.primaryText}>Share invite</Text></Pressable>
        <Pressable disabled={busy} onPress={() => void regenerate()} style={styles.secondary}>{busy ? <ActivityIndicator color="#28634E" /> : <Text style={styles.secondaryText}>Regenerate code</Text>}</Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 20, backgroundColor: "#E8F1EC", borderWidth: 1, borderColor: "#D4E3DA" },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: { color: "#47745F", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: "#18251F", fontSize: 20, fontWeight: "900", marginTop: 5 },
  body: { color: "#5E6B65", fontSize: 14, lineHeight: 20, marginTop: 12 },
  label: { color: "#5E6B65", fontSize: 11, fontWeight: "800", marginTop: 16, marginBottom: 6, textTransform: "uppercase" },
  valueRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, paddingHorizontal: 13, backgroundColor: "#FFFFFF" },
  code: { flex: 1, color: "#18251F", fontSize: 19, fontWeight: "900", letterSpacing: 1.8 },
  link: { flex: 1, color: "#33443C", fontSize: 13, fontWeight: "600" },
  copy: { color: "#28634E", fontSize: 11, fontWeight: "900" },
  notice: { color: "#47745F", fontSize: 12, lineHeight: 17, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  primary: { flex: 1.4, alignItems: "center", borderRadius: 12, padding: 13, backgroundColor: "#28634E" },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  secondary: { flex: 1, alignItems: "center", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#B6C9BE", backgroundColor: "#FFFFFF" },
  disabled: { opacity: 0.55 },
  secondaryText: { color: "#28634E", fontWeight: "900" },
});
