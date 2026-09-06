import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useRoom } from "@/features/rooms/RoomProvider";
import type { RoomMember } from "@/features/rooms/types";
import { useChores } from "@/features/shared-data/useChores";
import type { ChorePriority as Priority, ChoreRecurrence as Recurrence, NestChore } from "@/features/shared-data/types";

type Status = "Active" | "Upcoming" | "Completed";
type Chore = NestChore & { assignee: string; rotation: string[]; completedByName: string | null };

const recurrenceDays: Record<Recurrence, number> = { Once: 0, Weekly: 7, "Every 2 weeks": 14, Monthly: 31 };

function dueAsDate(due: string) {
  const parsed = new Date(`${due}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function displayDue(due: string) {
  const date = dueAsDate(due);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : due;
}

function displayedStatus(chore: NestChore): Status {
  if (chore.status === "Completed") return "Completed";
  const due = dueAsDate(chore.due);
  if (!due) return chore.status;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (chore.recurrence === "Once") return daysUntilDue <= 0 ? "Active" : "Upcoming";
  return daysUntilDue <= recurrenceDays[chore.recurrence] ? "Active" : "Upcoming";
}

function sameRoommateGroup(first: string[], second: string[]) {
  return first.length === second.length && [...first].sort().every((member, index) => member === [...second].sort()[index]);
}

function fairestAssignee(rotation: string[], chores: NestChore[], fallback: string) {
  if (rotation.length < 2) return fallback;
  const counts = rotation.reduce<Record<string, number>>((current, member) => ({ ...current, [member]: 0 }), {});
  chores.filter((chore) => chore.status !== "Completed" && sameRoommateGroup(chore.rotationUserIds, rotation)).forEach((chore) => { if (chore.assigneeUserId in counts) counts[chore.assigneeUserId] += 1; });
  const fewest = Math.min(...Object.values(counts));
  return rotation.find((member) => counts[member] === fewest) ?? fallback;
}

function errorMessage(caught: unknown) {
  return typeof caught === "object" && caught && "message" in caught ? String(caught.message) : "Please try again.";
}

export default function ChoresScreen() {
  const { room, user } = useRoom();
  if (!room || !user) return null;

  return <ChoresContent members={room.members} roomId={room.room.id} userId={user.id} />;
}

function ChoresContent({ members, roomId, userId }: { members: RoomMember[]; roomId: string; userId: string }) {
  const { chores: storedChores, complete, error, loading, refresh, remove, save } = useChores(roomId, userId);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState("Everyone");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dueFilter, setDueFilter] = useState("All dates");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(userId);
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<Recurrence>("Once");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [rotation, setRotation] = useState<string[]>([]);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const memberNames = useMemo(() => new Map(members.map((member) => [member.userId, member.displayName])), [members]);
  const chores = useMemo<Chore[]>(() => storedChores.map((chore) => ({
    ...chore,
    assignee: memberNames.get(chore.assigneeUserId) ?? "Former member",
    rotation: chore.rotationUserIds.map((id) => memberNames.get(id) ?? "Former member"),
    completedByName: chore.completedBy ? memberNames.get(chore.completedBy) ?? "Former member" : "Former member",
  })), [memberNames, storedChores]);

  const filtered = useMemo(() => chores.filter((chore) => {
    const currentStatus = displayedStatus(chore);
    if (personFilter !== "Everyone" && chore.assignee !== personFilter) return false;
    if (statusFilter !== "All" && currentStatus !== statusFilter) return false;
    if (dueFilter === "Overdue" && !(currentStatus === "Active" && (dueAsDate(chore.due)?.getTime() ?? Infinity) < new Date().setHours(0, 0, 0, 0))) return false;
    if (dueFilter === "Upcoming" && currentStatus !== "Upcoming") return false;
    return true;
  }), [chores, personFilter, statusFilter, dueFilter]);

  const openForm = (chore?: Chore) => {
    if (chore) { setEditingId(chore.id); setTitle(chore.title); setDescription(chore.description); setAssignee(chore.assigneeUserId); setDue(chore.due); setRecurrence(chore.recurrence); setPriority(chore.priority); setRotation(chore.rotationUserIds); setRotationEnabled(chore.rotationUserIds.length > 1); }
    else { setEditingId(null); setTitle(""); setDescription(""); setAssignee(userId); setDue(new Date().toISOString().slice(0, 10)); setRecurrence("Once"); setPriority("Normal"); setRotation([]); setRotationEnabled(false); }
    setShowForm(true);
  };

  const saveChore = async () => {
    if (!title.trim() || saving) return;
    const activeRotation = rotationEnabled ? Array.from(new Set([...rotation, assignee])) : [];
    const fairAssignee = fairestAssignee(activeRotation, storedChores.filter((item) => item.id !== editingId), assignee);
    try {
      setSaving(true);
      await save({ title, description, assigneeUserId: fairAssignee, due, priority, recurrence, rotationUserIds: activeRotation }, editingId ?? undefined);
      setShowForm(false);
    } catch (caught) {
      Alert.alert("Couldn’t save chore", errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const completeChore = async (chore: Chore) => {
    try {
      await complete(chore.id);
    } catch (caught) {
      Alert.alert("Couldn’t complete chore", errorMessage(caught));
    }
  };

  const deleteChore = async (id: string) => {
    try {
      await remove(id);
    } catch (caught) {
      Alert.alert("Couldn’t delete chore", errorMessage(caught));
    }
  };
  const confirmDelete = (chore: Chore) => {
    const message = `Delete “${chore.title}”? This cannot be undone.`;
    const performDelete = () => void deleteChore(chore.id);

    if (Platform.OS === "web") {
      if (globalThis.confirm(message)) performDelete();
      return;
    }

    Alert.alert("Delete chore?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: performDelete },
    ]);
  };
  const toggleRotationMember = (member: string) => setRotation((current) => current.includes(member) ? current.filter((item) => item !== member) : [...current, member]);

  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor="#28634E" />}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>Shared home</Text><Text style={styles.title}>Chores</Text></View><Pressable onPress={() => openForm()} style={styles.addButton}><Text style={styles.addButtonText}>+ Add</Text></Pressable></View>
    <Text style={styles.intro}>Keep the household moving, together.</Text>
    {error ? <Text style={styles.errorText}>Couldn’t load shared chores: {error}</Text> : null}
    <Text style={styles.filterLabel}>Filters</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      <Filter value={personFilter} options={["Everyone", ...members.map((member) => member.displayName)]} onChange={setPersonFilter} />
      <Filter value={statusFilter} options={["All", "Active", "Upcoming", "Completed"]} onChange={setStatusFilter} />
      <Filter value={dueFilter} options={["All dates", "Overdue", "Upcoming"]} onChange={setDueFilter} />
    </ScrollView>
    {showForm ? <View style={styles.form}><Text style={styles.formTitle}>{editingId ? "Edit chore" : "New chore"}</Text><TextInput value={title} onChangeText={setTitle} placeholder="Chore title" style={styles.input} /><TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" style={styles.input} /><Text style={styles.fieldLabel}>Assigned roommate</Text><MemberChoiceRow members={members} selected={assignee} onChange={setAssignee} /><Text style={styles.fieldLabel}>Due date</Text><CalendarField value={due} onChange={setDue} /><Text style={styles.fieldLabel}>Priority</Text><ChoiceRow values={["Low", "Normal", "High"]} selected={priority} onChange={(value) => setPriority(value as Priority)} /><Text style={styles.fieldLabel}>Repeats</Text><ChoiceRow values={["Once", "Weekly", "Every 2 weeks", "Monthly"]} selected={recurrence} onChange={(value) => setRecurrence(value as Recurrence)} />
      {recurrence !== "Once" ? <><Text style={styles.fieldLabel}>Shared chore</Text><ChoiceRow values={["No", "Yes"]} selected={rotationEnabled ? "Yes" : "No"} onChange={(value) => setRotationEnabled(value === "Yes")} />{rotationEnabled ? <><Text style={styles.fieldLabel}>Share this chore with</Text><Text style={styles.hint}>Chores with the same selected roommates are spread evenly, so everyone carries a fair share.</Text><View style={styles.memberGrid}>{members.map((member) => <Pressable key={member.userId} onPress={() => toggleRotationMember(member.userId)} style={[styles.memberButton, rotation.includes(member.userId) && styles.memberButtonSelected]}><Text style={[styles.memberText, rotation.includes(member.userId) && styles.memberTextSelected]}>{member.displayName}</Text></Pressable>)}</View></> : null}</> : null}
      <View style={styles.formActions}><Pressable onPress={() => setShowForm(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => void saveChore()} style={styles.saveButton}>{saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>{editingId ? "Save changes" : "Create chore"}</Text>}</Pressable></View>
    </View> : null}
    <Section title="Active" count={filtered.filter((chore) => displayedStatus(chore) === "Active").length} />
    {filtered.filter((chore) => displayedStatus(chore) === "Active").map((chore) => <ChoreCard key={chore.id} chore={chore} onComplete={completeChore} onEdit={openForm} onDelete={confirmDelete} />)}
    <Section title="Upcoming" count={filtered.filter((chore) => displayedStatus(chore) === "Upcoming").length} />
    {filtered.filter((chore) => displayedStatus(chore) === "Upcoming").map((chore) => <ChoreCard key={chore.id} chore={chore} onComplete={completeChore} onEdit={openForm} onDelete={confirmDelete} />)}
    <Section title="Completed" count={filtered.filter((chore) => displayedStatus(chore) === "Completed").length} />
    {filtered.filter((chore) => displayedStatus(chore) === "Completed").map((chore) => <ChoreCard key={chore.id} chore={chore} onComplete={completeChore} onEdit={openForm} onDelete={confirmDelete} />)}
    {!loading && !filtered.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No chores here yet</Text><Text style={styles.emptyText}>Try changing filters or create the first chore for your home.</Text><Pressable onPress={() => openForm()} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create first chore</Text></Pressable></View> : null}
  </ScrollView></View>;
}

function Filter({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <Pressable onPress={() => onChange(options[(options.indexOf(value) + 1) % options.length])} style={styles.filter}><Text style={styles.filterText}>{value} ▾</Text></Pressable>; }
function ChoiceRow({ values, selected, onChange }: { values: string[]; selected: string; onChange: (value: string) => void }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>{values.map((value) => <Pressable key={value} onPress={() => onChange(value)} style={[styles.choice, selected === value && styles.choiceSelected]}><Text style={[styles.choiceText, selected === value && styles.choiceTextSelected]}>{value}</Text></Pressable>)}</ScrollView>; }
function MemberChoiceRow({ members, selected, onChange }: { members: RoomMember[]; selected: string; onChange: (value: string) => void }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>{members.map((member) => <Pressable key={member.userId} onPress={() => onChange(member.userId)} style={[styles.choice, selected === member.userId && styles.choiceSelected]}><Text style={[styles.choiceText, selected === member.userId && styles.choiceTextSelected]}>{member.displayName}</Text></Pressable>)}</ScrollView>; }
function Section({ title, count }: { title: string; count: number }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.count}>{count}</Text></View>; }
function CalendarField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => dueAsDate(value) ?? new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const numberOfDays = new Date(year, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: firstWeekday + numberOfDays }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const chooseDay = (day: number) => { const date = new Date(year, monthIndex, day); onChange(date.toISOString().slice(0, 10)); setOpen(false); };
  return <><Pressable onPress={() => setOpen(true)} style={calendarStyles.field}><Text style={calendarStyles.fieldText}>{displayDue(value)}</Text><Text style={calendarStyles.calendarIcon}>▣</Text></Pressable><Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}><View style={calendarStyles.overlay}><View style={calendarStyles.modal}><View style={calendarStyles.monthRow}><Pressable onPress={() => setMonth(new Date(year, monthIndex - 1, 1))} style={calendarStyles.monthButton}><Text style={calendarStyles.monthButtonText}>‹</Text></Pressable><Text style={calendarStyles.monthTitle}>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Text><Pressable onPress={() => setMonth(new Date(year, monthIndex + 1, 1))} style={calendarStyles.monthButton}><Text style={calendarStyles.monthButtonText}>›</Text></Pressable></View><View style={calendarStyles.week}>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={calendarStyles.weekday}>{day}</Text>)}</View><View style={calendarStyles.days}>{days.map((day, index) => day === null ? <View key={`blank-${index}`} style={calendarStyles.day} /> : <Pressable key={day} onPress={() => chooseDay(day)} style={[calendarStyles.day, value === new Date(year, monthIndex, day).toISOString().slice(0, 10) && calendarStyles.selectedDay]}><Text style={[calendarStyles.dayText, value === new Date(year, monthIndex, day).toISOString().slice(0, 10) && calendarStyles.selectedDayText]}>{day}</Text></Pressable>)}</View><Pressable onPress={() => setOpen(false)} style={calendarStyles.done}><Text style={calendarStyles.doneText}>Done</Text></Pressable></View></View></Modal></>;
}
function ChoreCard({ chore, onComplete, onEdit, onDelete }: { chore: Chore; onComplete: (chore: Chore) => void; onEdit: (chore: Chore) => void; onDelete: (chore: Chore) => void }) { const status = displayedStatus(chore); const today = new Date().setHours(0, 0, 0, 0); const overdue = status === "Active" && (dueAsDate(chore.due)?.getTime() ?? Infinity) < today; const completedAt = chore.completedAt ? new Date(chore.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""; return <View style={[styles.card, overdue && styles.overdueCard]}><View style={styles.cardHeader}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{chore.title}</Text>{chore.description ? <Text style={styles.description}>{chore.description}</Text> : null}</View><Text style={[styles.priority, chore.priority === "High" && styles.highPriority]}>{chore.priority}</Text></View><Text style={[styles.meta, overdue && styles.overdueText]}>{overdue ? "Overdue · " : ""}{displayDue(chore.due)} · {chore.assignee}</Text>{chore.recurrence !== "Once" ? <Text style={styles.repeat}>↻ {chore.recurrence}{chore.rotation.length > 1 ? ` · shared with ${chore.rotation.join(", ")}` : ""}</Text> : null}{status === "Completed" ? <View><Text style={styles.completed}>Completed by {chore.completedByName} · {completedAt}</Text><Pressable onPress={() => onDelete(chore)}><Text style={styles.deleteAction}>Delete</Text></Pressable></View> : <View style={styles.actions}>{status === "Active" ? <Pressable onPress={() => onComplete(chore)} style={styles.completeButton}><Text style={styles.completeText}>Mark complete</Text></Pressable> : <Text style={styles.waitingText}>Available when active</Text>}<Pressable onPress={() => onEdit(chore)}><Text style={styles.textAction}>Edit</Text></Pressable><Pressable onPress={() => onDelete(chore)}><Text style={styles.deleteAction}>Delete</Text></Pressable></View>}</View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF" }, content: { padding: 20, paddingTop: 66, paddingBottom: 34 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }, eyebrow: { color: "#28634E", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }, title: { color: "#18251F", fontSize: 30, fontWeight: "800", marginTop: 3 }, intro: { color: "#64716B", marginTop: 6 }, errorText: { color: "#A13D32", marginTop: 12, lineHeight: 19 }, addButton: { backgroundColor: "#28634E", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }, addButtonText: { color: "white", fontWeight: "800" }, filterLabel: { color: "#18251F", fontWeight: "800", marginTop: 24, marginBottom: 8 }, filterRow: { gap: 8 }, filter: { borderRadius: 18, borderWidth: 1, borderColor: "#D3DCD5", backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 8 }, filterText: { color: "#28634E", fontWeight: "700", fontSize: 12 }, form: { backgroundColor: "white", borderRadius: 18, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#E4E8E3" }, formTitle: { color: "#18251F", fontSize: 19, fontWeight: "800", marginBottom: 12 }, input: { borderWidth: 1, borderColor: "#E4E8E3", backgroundColor: "#FBFCFA", borderRadius: 10, padding: 12, marginBottom: 10, color: "#18251F" }, fieldLabel: { color: "#18251F", fontWeight: "800", fontSize: 13, marginTop: 5, marginBottom: 7 }, hint: { color: "#64716B", fontSize: 12, lineHeight: 17, marginTop: -3, marginBottom: 8 }, choiceRow: { gap: 7, paddingBottom: 7 }, choice: { borderWidth: 1, borderColor: "#D3DCD5", borderRadius: 17, paddingVertical: 7, paddingHorizontal: 10 }, choiceSelected: { backgroundColor: "#DDF0E5", borderColor: "#28634E" }, choiceText: { color: "#64716B", fontSize: 12, fontWeight: "700" }, choiceTextSelected: { color: "#28634E" }, memberGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }, memberButton: { borderWidth: 1, borderColor: "#D3DCD5", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }, memberButtonSelected: { backgroundColor: "#DDF0E5", borderColor: "#28634E" }, memberText: { color: "#64716B", fontSize: 12, fontWeight: "700" }, memberTextSelected: { color: "#28634E" }, formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 8 }, cancelButton: { padding: 11 }, cancelText: { color: "#64716B", fontWeight: "800" }, saveButton: { minWidth: 112, alignItems: "center", backgroundColor: "#28634E", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 }, saveText: { color: "white", fontWeight: "800" }, section: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 25, marginBottom: 9 }, sectionTitle: { color: "#18251F", fontSize: 18, fontWeight: "800" }, count: { color: "#64716B", fontSize: 12, fontWeight: "800", backgroundColor: "#E7ECE8", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }, card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 16, padding: 15, marginBottom: 10 }, overdueCard: { backgroundColor: "#FFF8F0", borderColor: "#F4CFAB" }, cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, cardCopy: { flex: 1 }, cardTitle: { color: "#18251F", fontSize: 16, fontWeight: "800" }, description: { color: "#64716B", fontSize: 13, marginTop: 3 }, priority: { color: "#64716B", fontWeight: "800", fontSize: 11, backgroundColor: "#EEF1EE", alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }, highPriority: { color: "#9C4C1B", backgroundColor: "#FFE5D5" }, meta: { color: "#64716B", fontSize: 13, marginTop: 11 }, overdueText: { color: "#B9652C", fontWeight: "700" }, repeat: { color: "#28634E", fontSize: 12, marginTop: 6 }, actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 13 }, completeButton: { backgroundColor: "#DDF0E5", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, completeText: { color: "#28634E", fontSize: 12, fontWeight: "800" }, waitingText: { color: "#8A948E", fontSize: 12, fontWeight: "700" }, textAction: { color: "#28634E", fontWeight: "800", fontSize: 12 }, deleteAction: { color: "#B65A50", fontWeight: "800", fontSize: 12, marginTop: 10 }, completed: { color: "#47755E", fontSize: 12, fontWeight: "700", marginTop: 10 }, empty: { borderStyle: "dashed", borderWidth: 1, borderColor: "#B9C5BD", borderRadius: 16, backgroundColor: "white", padding: 25, alignItems: "center" }, emptyTitle: { color: "#18251F", fontWeight: "800", fontSize: 16 }, emptyText: { color: "#64716B", textAlign: "center", marginTop: 6, lineHeight: 19 }, emptyButton: { backgroundColor: "#DDF0E5", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14 }, emptyButtonText: { color: "#28634E", fontWeight: "800", fontSize: 12 } });

const calendarStyles = StyleSheet.create({ field: { borderWidth: 1, borderColor: "#E4E8E3", backgroundColor: "#FBFCFA", borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, fieldText: { color: "#18251F" }, calendarIcon: { color: "#28634E", fontSize: 15 }, overlay: { flex: 1, backgroundColor: "rgba(24,37,31,0.35)", alignItems: "center", justifyContent: "center", padding: 24 }, modal: { width: "100%", maxWidth: 360, backgroundColor: "white", borderRadius: 20, padding: 18 }, monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }, monthTitle: { color: "#18251F", fontWeight: "800", fontSize: 17 }, monthButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#DDF0E5", alignItems: "center", justifyContent: "center" }, monthButtonText: { color: "#28634E", fontSize: 25, lineHeight: 29 }, week: { flexDirection: "row", marginBottom: 5 }, weekday: { width: "14.2857%", textAlign: "center", color: "#64716B", fontSize: 11, fontWeight: "800" }, days: { flexDirection: "row", flexWrap: "wrap" }, day: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 20 }, selectedDay: { backgroundColor: "#28634E" }, dayText: { color: "#18251F", fontWeight: "700" }, selectedDayText: { color: "white" }, done: { alignSelf: "flex-end", marginTop: 15, backgroundColor: "#28634E", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 }, doneText: { color: "white", fontWeight: "800" } });
