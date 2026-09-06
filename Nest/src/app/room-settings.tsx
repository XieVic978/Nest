import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { toRoomError } from "@/features/rooms/errors";
import { useRoom } from "@/features/rooms/RoomProvider";
import type { RoomMember } from "@/features/rooms/types";
import { confirmAction } from "@/lib/confirmAction";

export default function RoomSettingsScreen() {
  const { regenerateJoinCode, removeMember, room, transferAdmin, user } = useRoom();
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nextAdmin = room?.members
    .filter((member) => member.userId !== user?.id)
    .sort((a, b) => {
      const joinedDifference =
        new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      return joinedDifference || a.userId.localeCompare(b.userId);
    })[0];

  if (!room || room.membership.role !== "admin") {
    return <View style={styles.center}><Text style={styles.title}>Admin access required</Text><Pressable onPress={() => router.replace("/(room)")} style={styles.primary}><Text style={styles.primaryText}>Back to Nest</Text></Pressable></View>;
  }

  async function runMemberAction(member: RoomMember, action: "remove" | "transfer") {
    setBusyMember(member.userId);
    setNotice(null);
    try {
      if (action === "remove") {
        await removeMember(member.userId);
        setNotice(`${member.displayName} was removed from the Nest.`);
      } else {
        await transferAdmin(member.userId);
        setNotice(`${member.displayName} is now the Nest admin.`);
        router.replace("/(room)");
      }
    } catch (caught) {
      setNotice(toRoomError(caught).message);
    } finally {
      setBusyMember(null);
    }
  }

  function confirmMemberAction(member: RoomMember, action: "remove" | "transfer") {
    const transfer = action === "transfer";
    confirmAction({
      title: transfer ? "Transfer admin access?" : "Remove roommate?",
      message: transfer
        ? `${member.displayName} will become the admin and you will become a regular member.`
        : `${member.displayName} will immediately lose access to this Nest and its shared data.`,
      confirmText: transfer ? "Transfer" : "Remove",
      destructive: !transfer,
      onConfirm: () => runMemberAction(member, action),
    });
  }

  async function regenerate() {
    setNotice(null);
    try {
      await regenerateJoinCode();
      setNotice("The permanent Nest code was replaced. The previous code no longer works.");
    } catch (caught) {
      setNotice(toRoomError(caught).message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹ Back to Nest</Text></Pressable>
      <Text style={styles.eyebrow}>ADMIN SETTINGS</Text>
      <Text style={styles.title}>{room.room.name}</Text>
      <Text style={styles.body}>Manage access to this Nest. Removed members immediately lose access to all room data.</Text>

      <View style={styles.inviteRow}>
        <View style={styles.inviteCopy}><Text style={styles.cardTitle}>Need a new permanent code?</Text><Text style={styles.cardBody}>The current link and code will stop working.</Text></View>
        <Pressable onPress={() => void regenerate()} style={styles.regenerate}><Text style={styles.regenerateText}>Regenerate</Text></Pressable>
      </View>

      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      <Text style={styles.sectionTitle}>Members</Text>
      <View style={styles.memberCard}>
        {room.members.map((member, index) => {
          const isSelf = member.userId === user?.id;
          return (
            <View key={member.userId} style={[styles.memberRow, index < room.members.length - 1 && styles.divider]}>
              <View style={styles.memberCopy}><Text style={styles.memberName}>{member.displayName}{isSelf ? " (you)" : ""}</Text><Text style={styles.role}>{member.role === "admin" ? "Admin" : "Member"}</Text></View>
              {busyMember === member.userId ? <ActivityIndicator color="#4975A8" /> : null}
              {!isSelf && member.role !== "admin" && busyMember !== member.userId ? <View style={styles.actions}><Pressable onPress={() => confirmMemberAction(member, "transfer")} style={styles.transferButton}><Text style={styles.transferText}>Make admin</Text></Pressable><Pressable onPress={() => confirmMemberAction(member, "remove")} style={styles.removeButton}><Text style={styles.removeText}>Remove</Text></Pressable></View> : null}
            </View>
          );
        })}
      </View>

      <Text style={styles.warning}>
        {room.members.length === 1
          ? "You’re the only member. Leaving from Profile will permanently delete this Nest and its shared data."
          : `If you leave, ${nextAdmin?.displayName ?? "the next member"} will automatically become admin and current invitations will be revoked.`}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 40, backgroundColor: "#FFFCF5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#FFFCF5" },
  back: { color: "#4975A8", fontSize: 14, fontWeight: "800", marginBottom: 28 },
  eyebrow: { color: "#8B6F47", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#18251F", fontSize: 30, fontWeight: "900", marginTop: 5 },
  body: { color: "#5E6B65", fontSize: 15, lineHeight: 22, marginTop: 9 },
  primary: { marginTop: 20, borderRadius: 14, padding: 14, backgroundColor: "#4975A8" },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 28, borderRadius: 18, padding: 17, backgroundColor: "#E8F1EC" },
  inviteCopy: { flex: 1 },
  cardTitle: { color: "#24352D", fontSize: 15, fontWeight: "900" },
  cardBody: { color: "#68766F", fontSize: 12, lineHeight: 17, marginTop: 3 },
  regenerate: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FFFFFF" },
  regenerateText: { color: "#4975A8", fontSize: 12, fontWeight: "900" },
  notice: { color: "#47745F", fontSize: 13, lineHeight: 18, marginTop: 12 },
  sectionTitle: { color: "#18251F", fontSize: 21, fontWeight: "900", marginTop: 30, marginBottom: 10 },
  memberCard: { borderRadius: 18, paddingHorizontal: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E8E8" },
  memberRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { borderBottomColor: "#DDE2DE", borderBottomWidth: StyleSheet.hairlineWidth },
  memberCopy: { flex: 1 },
  memberName: { color: "#24352D", fontSize: 14, fontWeight: "800" },
  role: { color: "#89938E", fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 7 },
  transferButton: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: "#E8F1EC" },
  transferText: { color: "#4975A8", fontSize: 10, fontWeight: "900" },
  removeButton: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: "#F7E7E4" },
  removeText: { color: "#A13D32", fontSize: 10, fontWeight: "900" },
  warning: { color: "#87683E", fontSize: 13, lineHeight: 19, marginTop: 14 },
});
