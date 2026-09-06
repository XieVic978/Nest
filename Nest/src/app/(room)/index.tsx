import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { SharedCalendar } from "@/components/shared-calendar";
import { InviteCard } from "@/components/rooms/InviteCard";
import { useRoom } from "@/features/rooms/RoomProvider";
import type { RoomInvite, RoomSnapshot } from "@/features/rooms/types";
import { useAnnouncements } from "@/features/shared-data/useAnnouncements";
import type { NestAnnouncement } from "@/features/shared-data/types";

type Announcement = NestAnnouncement & { author: string; date: string };

export default function HomeScreen() {
  const { activeInvite, refresh, regenerateInvite, room, user } = useRoom();

  if (!room || !user) return null;

  return <HomeContent activeInvite={activeInvite} refreshRoom={refresh} regenerateInvite={regenerateInvite} room={room} userId={user.id} />;
}

function formatAnnouncementDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently"
    : date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function HomeContent({ activeInvite, refreshRoom, regenerateInvite, room, userId }: { activeInvite: RoomInvite | null; refreshRoom: () => Promise<void>; regenerateInvite: () => Promise<RoomInvite>; room: RoomSnapshot; userId: string }) {
  const { announcements: storedAnnouncements, dismiss, error, loading, markRead, publish: publishAnnouncement, refresh, remove } = useAnnouncements(room.room.id, userId);
  const [formVisible, setFormVisible] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const memberNames = useMemo(() => new Map(room.members.map((member) => [member.userId, member.displayName])), [room.members]);
  const residentNames = useMemo(() => [...new Set(room.members.map((member) => member.displayName))], [room.members]);
  const currentUserName = memberNames.get(userId) ?? "You";
  const announcements = useMemo<Announcement[]>(() => storedAnnouncements.map((item) => ({
    ...item,
    author: item.automated ? "Nest" : memberNames.get(item.authorUserId) ?? "Former member",
    date: formatAnnouncementDate(item.createdAt),
  })), [memberNames, storedAnnouncements]);

  const unread = announcements.filter((item) => !item.read).length;
  const ordered = useMemo(() => [...announcements].sort((first, second) => Number(second.pinned) - Number(first.pinned)), [announcements]);
  const visibleAnnouncements = ordered.filter((item) => showPast ? item.dismissed : !item.dismissed);
  const pastCount = announcements.filter((item) => item.dismissed).length;
  const isAdmin = room.membership.role === "admin";

  const showError = (title: string, caught: unknown) => Alert.alert(title, typeof caught === "object" && caught && "message" in caught ? String(caught.message) : "Please try again.");
  const openRelated = async (item: Announcement) => { try { await markRead(item.id); } catch (caught) { showError("Couldn’t mark announcement read", caught); } if (item.target === "chores") router.push("/(room)/chores"); if (item.target === "payments") router.push("/(room)/payments"); if (item.target === "groceries") router.push("/(room)/groceries"); };
  const confirmDelete = (item: Announcement) => Alert.alert("Delete announcement?", `Delete “${item.title}” for everyone in this Nest?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void remove(item.id).catch((caught) => showError("Couldn’t delete announcement", caught)) }]);
  const publish = async (item: { title: string; pinned: boolean }) => { try { await publishAnnouncement(item); setFormVisible(false); return true; } catch (caught) { showError("Couldn’t publish announcement", caught); return false; } };
  const addCalendarAnnouncement = (title: string) => { void publishAnnouncement({ title, automated: true, target: "calendar" }).catch((caught) => showError("Couldn’t share calendar update", caught)); };
  const refreshAll = async () => { await Promise.all([refreshRoom(), refresh()]); };

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl onRefresh={() => void refreshAll()} refreshing={loading} tintColor="#28634E" />}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>YOUR NEST</Text><Text style={styles.title}>{room.room.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push("/profile")} style={styles.profileButton}><Text style={styles.profileText}>Profile</Text></Pressable></View>
      <View style={styles.residentCard}><Text style={styles.residentLabel}>RESIDENTS</Text><View style={styles.residents}>{room.members.map((member) => <View key={member.userId} style={styles.resident}><View style={styles.avatar}><Text style={styles.avatarText}>{member.displayName.slice(0, 1).toUpperCase()}</Text></View><Text numberOfLines={1} style={styles.residentName}>{member.userId === userId ? "You" : member.displayName}</Text></View>)}</View></View>
      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Announcements</Text><Text style={styles.sectionDetail}>{unread ? `${unread} unread` : "All caught up"}</Text></View><View style={styles.sectionActions}><Pressable onPress={() => setShowPast((value) => !value)}><Text style={styles.pastButton}>{showPast ? "Current" : `Past${pastCount ? ` (${pastCount})` : ""}`}</Text></Pressable><Pressable onPress={() => setFormVisible(true)} style={styles.newButton}><Text style={styles.newButtonText}>+ Post</Text></Pressable></View></View>
      {error ? <Text style={styles.errorText}>Couldn’t load shared announcements: {error}</Text> : null}
      <View style={styles.announcementsViewport}><Text style={styles.scrollHint}>Swipe up to see more announcements</Text><ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={styles.announcementsList}>{loading ? <ActivityIndicator color="#28634E" style={styles.loading} /> : visibleAnnouncements.length ? visibleAnnouncements.map((item) => <AnnouncementCard key={item.id} canDelete={item.authorUserId === userId || isAdmin} item={item} onRead={() => void markRead(item.id).catch((caught) => showError("Couldn’t mark announcement read", caught))} onDismiss={() => void dismiss(item.id).catch((caught) => showError("Couldn’t dismiss announcement", caught))} onDelete={() => confirmDelete(item)} onOpen={() => void openRelated(item)} />) : <EmptyAnnouncements showPast={showPast} onPost={() => setFormVisible(true)} />}</ScrollView></View>
      <SharedCalendar currentUserName={currentUserName} onActivity={addCalendarAnnouncement} residents={residentNames} />
      <InviteCard invite={activeInvite} onRegenerate={regenerateInvite} />
    </ScrollView>
    <AnnouncementForm canPin={isAdmin} visible={formVisible} onClose={() => setFormVisible(false)} onPublish={publish} />
  </View>;
}

function AnnouncementCard({ canDelete, item, onRead, onDismiss, onDelete, onOpen }: { canDelete: boolean; item: Announcement; onRead: () => void; onDismiss: () => void; onDelete: () => void; onOpen: () => void }) { return <View style={[styles.card, !item.read && styles.unreadCard]}><View style={styles.cardTop}>{item.pinned ? <Text style={styles.pinned}>PINNED</Text> : <View />}{!item.read ? <View style={styles.unreadDot} /> : null}</View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>By {item.author} · {item.date}</Text><View style={styles.actions}>{item.automated && item.target && item.target !== "calendar" ? <Pressable onPress={onOpen} style={styles.openButton}><Text style={styles.openButtonText}>Open related item</Text></Pressable> : null}{!item.read ? <Pressable onPress={onRead}><Text style={styles.actionText}>Mark read</Text></Pressable> : null}<Pressable onPress={onDismiss}><Text style={styles.actionText}>Dismiss</Text></Pressable>{canDelete ? <Pressable onPress={onDelete}><Text style={styles.deleteText}>Delete</Text></Pressable> : null}</View></View>; }
function EmptyAnnouncements({ showPast, onPost }: { showPast: boolean; onPost: () => void }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>{showPast ? "No past announcements" : "No announcements yet"}</Text><Text style={styles.emptyText}>{showPast ? "Dismissed updates will appear here." : "Post the first update for your household."}</Text>{!showPast ? <Pressable onPress={onPost} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create announcement</Text></Pressable> : null}</View>; }
function AnnouncementForm({ canPin, visible, onClose, onPublish }: { canPin: boolean; visible: boolean; onClose: () => void; onPublish: (item: { title: string; pinned: boolean }) => Promise<boolean> }) { const [title, setTitle] = useState(""); const [pinned, setPinned] = useState(false); const [publishing, setPublishing] = useState(false); const publish = async () => { if (!title.trim()) { Alert.alert("Add an announcement", "Enter a title first."); return; } try { setPublishing(true); const published = await onPublish({ title: title.trim(), pinned: canPin && pinned }); if (published) { setTitle(""); setPinned(false); } } finally { setPublishing(false); } }; return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>New announcement</Text><Pressable onPress={onClose}><Text style={styles.close}>Close</Text></Pressable></View><ScrollView><Text style={styles.label}>TITLE</Text><TextInput value={title} onChangeText={setTitle} placeholder="What should the house know?" style={styles.input} />{canPin ? <Pressable onPress={() => setPinned((value) => !value)} style={styles.pinToggle}><Text style={styles.pinToggleText}>{pinned ? "✓" : "○"} Pin this announcement</Text></Pressable> : null}<Pressable disabled={publishing} onPress={() => void publish()} style={styles.publishButton}><Text style={styles.publishText}>{publishing ? "Publishing…" : "Publish announcement"}</Text></Pressable></ScrollView></View></View></Modal>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF" }, content: { padding: 20, paddingTop: 66, paddingBottom: 34 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }, eyebrow: { color: "#28634E", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, title: { fontSize: 31, fontWeight: "800", color: "#18251F", marginTop: 3 }, profileButton: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }, profileText: { color: "#28634E", fontWeight: "800", fontSize: 13 },
  residentCard: { backgroundColor: "white", borderColor: "#E4E8E3", borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14, flexDirection: "row", alignItems: "center" }, residentLabel: { color: "#64716B", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginRight: 12 }, residents: { flex: 1, flexDirection: "row", gap: 10, overflow: "hidden" }, resident: { alignItems: "center", flexDirection: "row", gap: 4, flexShrink: 1 }, avatar: { width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#DDF0E5" }, avatarText: { color: "#28634E", fontWeight: "800", fontSize: 11 }, residentName: { color: "#4F5C55", fontSize: 10, fontWeight: "700", flexShrink: 1 },
  sectionHeader: { marginTop: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: "#18251F", fontSize: 20, fontWeight: "800" }, sectionDetail: { color: "#64716B", fontSize: 12, marginTop: 1 }, sectionActions: { flexDirection: "row", alignItems: "center", gap: 11 }, pastButton: { color: "#28634E", fontSize: 12, fontWeight: "800" }, newButton: { backgroundColor: "#28634E", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 }, newButtonText: { color: "white", fontWeight: "800", fontSize: 12 },
  errorText: { color: "#A13D32", fontSize: 12, lineHeight: 18, marginTop: 10 },
  loading: { marginTop: 54 },
  announcementsViewport: { height: 310, marginTop: 8, borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 15, backgroundColor: "#FBFCFA", overflow: "hidden" }, scrollHint: { color: "#64716B", fontSize: 10, fontWeight: "700", textAlign: "center", paddingVertical: 6, backgroundColor: "#EEF3EF" }, announcementsList: { paddingHorizontal: 10, paddingBottom: 10 }, card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 17, padding: 16, marginTop: 12 }, unreadCard: { borderColor: "#8EB79C", borderLeftWidth: 4 }, cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, pinned: { color: "#9C4C1B", backgroundColor: "#FFE5D5", fontWeight: "800", fontSize: 10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#28634E" }, cardTitle: { color: "#18251F", fontWeight: "800", fontSize: 17, marginTop: 11 }, meta: { color: "#7D8781", fontSize: 12, marginTop: 11 }, actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 13, marginTop: 14 }, openButton: { backgroundColor: "#DDF0E5", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 }, openButtonText: { color: "#28634E", fontSize: 12, fontWeight: "800" }, actionText: { color: "#28634E", fontWeight: "800", fontSize: 12 }, deleteText: { color: "#B65A50", fontWeight: "800", fontSize: 12 },
  empty: { marginTop: 30, borderWidth: 1, borderStyle: "dashed", borderColor: "#B9C5BD", backgroundColor: "white", borderRadius: 17, padding: 28, alignItems: "center" }, emptyTitle: { color: "#18251F", fontWeight: "800", fontSize: 17 }, emptyText: { color: "#64716B", textAlign: "center", marginTop: 5 }, emptyButton: { backgroundColor: "#DDF0E5", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, marginTop: 15 }, emptyButtonText: { color: "#28634E", fontWeight: "800", fontSize: 12 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(24,37,31,.35)" }, sheet: { backgroundColor: "#F7F5EF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "92%" }, sheetHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }, sheetTitle: { color: "#18251F", fontSize: 24, fontWeight: "800" }, close: { color: "#28634E", fontWeight: "800" }, label: { color: "#64716B", fontWeight: "800", fontSize: 11, letterSpacing: 1, marginTop: 10, marginBottom: 7 }, input: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 11, padding: 12, color: "#18251F" }, pinToggle: { marginTop: 17 }, pinToggleText: { color: "#28634E", fontWeight: "800", fontSize: 13 }, publishButton: { backgroundColor: "#28634E", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 20, marginBottom: 8 }, publishText: { color: "white", fontWeight: "800" },
});
