import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { toRoomError } from "@/features/rooms/errors";
import { buildInviteLink, formatInviteCode } from "@/features/rooms/invite";
import type { RoomInvite } from "@/features/rooms/types";

type InviteCardProps = {
  invite: RoomInvite | null;
  onRegenerate: () => Promise<RoomInvite>;
};

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secondsPart = (seconds % 60).toString().padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

export function InviteCard({ invite, onRegenerate }: InviteCardProps) {
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = invite ? new Date(invite.expiresAt).getTime() - now : 0;
  const expired = !invite || remaining <= 0;
  const inviteLink = useMemo(
    () => (invite ? buildInviteLink(invite.token) : ""),
    [invite],
  );

  async function copy(value: string, label: string) {
    const copied = await Clipboard.setStringAsync(value);
    setNotice(copied ? `${label} copied.` : `Could not copy the ${label.toLowerCase()}.`);
  }

  async function regenerate() {
    setBusy(true);
    setNotice(null);
    try {
      await onRegenerate();
      setNow(Date.now());
      setNotice("A new 10-minute invitation is ready. Older invites no longer work.");
    } catch (caught) {
      setNotice(toRoomError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  async function shareInvite() {
    if (!invite) return;
    await Share.share({
      message: `Join my Nest with code ${formatInviteCode(invite.code)} or open ${inviteLink}. This invite expires in 10 minutes.`,
      title: "Join my Nest",
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>ROOMMATE INVITE</Text>
          <Text style={styles.title}>{expired ? "Create a fresh invite" : "Invite your roommates"}</Text>
        </View>
        {!expired ? <View style={styles.timerPill}><Text style={styles.timer}>{formatRemaining(remaining)}</Text></View> : null}
      </View>

      {expired ? (
        <Text style={styles.body}>Invitations last for 10 minutes. Generate a new link and code when your roommate is ready.</Text>
      ) : (
        <>
          <Text style={styles.label}>Invite code</Text>
          <Pressable accessibilityLabel="Copy invite code" onPress={() => void copy(formatInviteCode(invite.code), "Code")} style={styles.valueRow}>
            <Text selectable style={styles.code}>{formatInviteCode(invite.code)}</Text>
            <Text style={styles.copy}>COPY</Text>
          </Pressable>
          <Text style={styles.label}>App link</Text>
          <Pressable accessibilityLabel="Copy invite link" onPress={() => void copy(inviteLink, "Link")} style={styles.valueRow}>
            <Text numberOfLines={1} selectable style={styles.link}>{inviteLink}</Text>
            <Text style={styles.copy}>COPY</Text>
          </Pressable>
        </>
      )}

      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      <View style={styles.actions}>
        {!expired ? <Pressable onPress={() => void shareInvite()} style={styles.primary}><Text style={styles.primaryText}>Share invite</Text></Pressable> : null}
        <Pressable disabled={busy} onPress={() => void regenerate()} style={[styles.secondary, expired && styles.secondaryWide]}>{busy ? <ActivityIndicator color="#28634E" /> : <Text style={styles.secondaryText}>{expired ? "Generate invite" : "Regenerate"}</Text>}</Pressable>
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
  timerPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#FFFFFF" },
  timer: { color: "#28634E", fontVariant: ["tabular-nums"], fontSize: 13, fontWeight: "900" },
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
  secondaryWide: { flex: 1 },
  secondaryText: { color: "#28634E", fontWeight: "900" },
});
