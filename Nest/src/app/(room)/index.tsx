import { router } from "expo-router";
import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { InviteCard } from "@/components/rooms/InviteCard";
import { useRoom } from "@/features/rooms/RoomProvider";

export default function HomeScreen() {
  const { activeInvite, refresh, regenerateInvite, room, user } = useRoom();
  if (!room) return null;

  const isAdmin = room.membership.role === "admin";

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={false} tintColor="#28634E" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR NEST</Text>
          <Text style={styles.title}>{room.room.name}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push("/profile")} style={styles.profileButton}><Text style={styles.profileText}>Profile</Text></Pressable>
      </View>

      <View style={styles.welcome}>
        <Text style={styles.welcomeTitle}>Everyone’s home base</Text>
        <Text style={styles.welcomeBody}>Groceries, payments, chores, and documents shared with exactly the people below.</Text>
      </View>

      {isAdmin ? <InviteCard invite={activeInvite} onRegenerate={regenerateInvite} /> : null}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Roommates</Text>
          <Text style={styles.memberCount}>{room.members.length} {room.members.length === 1 ? "member" : "members"}</Text>
        </View>
        {isAdmin ? <Pressable onPress={() => router.push("/room-settings")} style={styles.manageButton}><Text style={styles.manageText}>Manage</Text></Pressable> : null}
      </View>

      <View style={styles.memberCard}>
        {room.members.map((member, index) => (
          <View key={member.userId} style={[styles.memberRow, index < room.members.length - 1 && styles.memberDivider]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{member.displayName.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.memberCopy}>
              <Text style={styles.memberName}>{member.displayName}{member.userId === user?.id ? " (you)" : ""}</Text>
              <Text style={styles.memberSince}>Joined {new Date(member.joinedAt).toLocaleDateString()}</Text>
            </View>
            {member.role === "admin" ? <View style={styles.adminBadge}><Text style={styles.adminText}>ADMIN</Text></View> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 68, paddingBottom: 40, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#8B6F47", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  title: { fontSize: 31, fontWeight: "900", letterSpacing: -0.6, color: "#18251F", marginTop: 3 },
  profileButton: { backgroundColor: "#FFFFFF", borderColor: "#E4E8E3", borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  profileText: { color: "#28634E", fontWeight: "800", fontSize: 13 },
  welcome: { borderRadius: 20, padding: 20, backgroundColor: "#2E493D" },
  welcomeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900" },
  welcomeBody: { color: "#DCE8E1", fontSize: 14, lineHeight: 20, marginTop: 7 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionTitle: { color: "#18251F", fontSize: 22, fontWeight: "900" },
  memberCount: { color: "#758079", fontSize: 13, marginTop: 3 },
  manageButton: { borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "#E8F1EC" },
  manageText: { color: "#28634E", fontSize: 13, fontWeight: "900" },
  memberCard: { borderRadius: 18, paddingHorizontal: 16, backgroundColor: "#FFFFFF", borderColor: "#E4E8E3", borderWidth: 1 },
  memberRow: { minHeight: 72, flexDirection: "row", alignItems: "center" },
  memberDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDE2DE" },
  avatar: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#DCE9E1" },
  avatarText: { color: "#28634E", fontSize: 16, fontWeight: "900" },
  memberCopy: { flex: 1, marginLeft: 12 },
  memberName: { color: "#24352D", fontSize: 15, fontWeight: "800" },
  memberSince: { color: "#89938E", fontSize: 12, marginTop: 3 },
  adminBadge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#F3EBDD" },
  adminText: { color: "#87683E", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
});
