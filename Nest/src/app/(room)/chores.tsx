import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type Recurrence = "Once" | "Weekly" | "Every 2 weeks" | "Monthly";
type Status = "Active" | "Upcoming" | "Completed";
type Priority = "Low" | "Normal" | "High";
type Chore = { id: string; title: string; description: string; assignee: string; due: string; status: Status; priority: Priority; recurrence: Recurrence; rotation: string[]; completedBy?: string; completedAt?: string };

const members = ["Alex", "Maya", "Jordan", "Sam"];
const initialChores: Chore[] = [
  { id: "trash", title: "Take out trash", description: "Bins go to the curb.", assignee: "Alex", due: "Sep 4", status: "Active", priority: "Normal", recurrence: "Weekly", rotation: ["Alex", "Maya"] },
  { id: "bathroom", title: "Clean bathroom", description: "Quick weekly clean.", assignee: "Maya", due: "Sep 8", status: "Upcoming", priority: "High", recurrence: "Every 2 weeks", rotation: [] },
  { id: "counters", title: "Wipe kitchen counters", description: "", assignee: "Jordan", due: "Sep 3", status: "Completed", priority: "Low", recurrence: "Once", rotation: [], completedBy: "Jordan", completedAt: "Sep 3, 4:30 PM" },
];

const recurrenceDays: Record<Recurrence, number> = { Once: 0, Weekly: 7, "Every 2 weeks": 14, Monthly: 30 };

function nextDueDate(due: string, recurrence: Recurrence) {
  const parsed = new Date(`${due}, 2026`);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  date.setDate(date.getDate() + recurrenceDays[recurrence]);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ChoresScreen() {
  const [chores, setChores] = useState(initialChores);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState("Everyone");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dueFilter, setDueFilter] = useState("All dates");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("Alex");
  const [due, setDue] = useState("Sep 12");
  const [recurrence, setRecurrence] = useState<Recurrence>("Once");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [rotation, setRotation] = useState<string[]>([]);

  const filtered = useMemo(() => chores.filter((chore) => {
    if (personFilter !== "Everyone" && chore.assignee !== personFilter) return false;
    if (statusFilter !== "All" && chore.status !== statusFilter) return false;
    if (dueFilter === "Overdue" && !(chore.status === "Active" && chore.due === "Sep 4")) return false;
    if (dueFilter === "Upcoming" && chore.status !== "Upcoming") return false;
    return true;
  }), [chores, personFilter, statusFilter, dueFilter]);

  const openForm = (chore?: Chore) => {
    if (chore) { setEditingId(chore.id); setTitle(chore.title); setDescription(chore.description); setAssignee(chore.assignee); setDue(chore.due); setRecurrence(chore.recurrence); setPriority(chore.priority); setRotation(chore.rotation); }
    else { setEditingId(null); setTitle(""); setDescription(""); setAssignee("Alex"); setDue("Sep 12"); setRecurrence("Once"); setPriority("Normal"); setRotation([]); }
    setShowForm(true);
  };

  const saveChore = () => {
    if (!title.trim()) return;
    const chore: Chore = { id: editingId ?? Date.now().toString(), title: title.trim(), description: description.trim(), assignee, due, status: "Upcoming", priority, recurrence, rotation };
    setChores((current) => editingId ? current.map((item) => item.id === editingId ? { ...item, ...chore, status: item.status, completedBy: item.completedBy, completedAt: item.completedAt } : item) : [chore, ...current]);
    setShowForm(false);
  };

  const completeChore = (chore: Chore) => {
    const completedAt = "Just now";
    const completed = { ...chore, status: "Completed" as Status, completedBy: chore.assignee, completedAt };
    const nextAssignee = chore.rotation.length > 1 ? chore.rotation[(chore.rotation.indexOf(chore.assignee) + 1) % chore.rotation.length] : chore.assignee;
    const next = recurrenceDays[chore.recurrence] ? { ...chore, id: `${chore.id}-${Date.now()}`, assignee: nextAssignee, due: nextDueDate(chore.due, chore.recurrence), status: "Upcoming" as Status, completedBy: undefined, completedAt: undefined } : null;
    setChores((current) => [completed, ...(next ? [next] : []), ...current.filter((item) => item.id !== chore.id)]);
  };

  const deleteChore = (id: string) => setChores((current) => current.filter((chore) => chore.id !== id));
  const toggleRotationMember = (member: string) => setRotation((current) => current.includes(member) ? current.filter((item) => item !== member) : [...current, member]);

  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>Shared home</Text><Text style={styles.title}>Chores</Text></View><Pressable onPress={() => openForm()} style={styles.addButton}><Text style={styles.addButtonText}>+ Add</Text></Pressable></View>
    <Text style={styles.intro}>Keep the household moving, together.</Text>
    <Text style={styles.filterLabel}>Filters</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      <Filter value={personFilter} options={["Everyone", ...members]} onChange={setPersonFilter} />
      <Filter value={statusFilter} options={["All", "Active", "Upcoming", "Completed"]} onChange={setStatusFilter} />
      <Filter value={dueFilter} options={["All dates", "Overdue", "Upcoming"]} onChange={setDueFilter} />
    </ScrollView>
    {showForm ? <View style={styles.form}><Text style={styles.formTitle}>{editingId ? "Edit chore" : "New chore"}</Text><TextInput value={title} onChangeText={setTitle} placeholder="Chore title" style={styles.input} /><TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" style={styles.input} /><Text style={styles.fieldLabel}>Assigned roommate</Text><ChoiceRow values={members} selected={assignee} onChange={setAssignee} /><Text style={styles.fieldLabel}>Due date</Text><TextInput value={due} onChangeText={setDue} placeholder="Sep 12" style={styles.input} /><Text style={styles.fieldLabel}>Priority</Text><ChoiceRow values={["Low", "Normal", "High"]} selected={priority} onChange={(value) => setPriority(value as Priority)} /><Text style={styles.fieldLabel}>Repeats</Text><ChoiceRow values={["Once", "Weekly", "Every 2 weeks", "Monthly"]} selected={recurrence} onChange={(value) => setRecurrence(value as Recurrence)} />
      {recurrence !== "Once" ? <><Text style={styles.fieldLabel}>Rotate assignment (optional)</Text><Text style={styles.hint}>Choose who takes turns each time this chore repeats.</Text><View style={styles.memberGrid}>{members.map((member) => <Pressable key={member} onPress={() => toggleRotationMember(member)} style={[styles.memberButton, rotation.includes(member) && styles.memberButtonSelected]}><Text style={[styles.memberText, rotation.includes(member) && styles.memberTextSelected]}>{member}</Text></Pressable>)}</View></> : null}
      <View style={styles.formActions}><Pressable onPress={() => setShowForm(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={saveChore} style={styles.saveButton}><Text style={styles.saveText}>{editingId ? "Save changes" : "Create chore"}</Text></Pressable></View>
    </View> : null}
    <Section title="Active" count={filtered.filter((chore) => chore.status === "Active").length} />
    {filtered.filter((chore) => chore.status === "Active").map((chore) => <ChoreCard key={chore.id} chore={chore} onComplete={completeChore} onEdit={openForm} onDelete={deleteChore} />)}
    <Section title="Upcoming" count={filtered.filter((chore) => chore.status === "Upcoming").length} />
    {filtered.filter((chore) => chore.status === "Upcoming").map((chore) => <ChoreCard key={chore.id} chore={chore} onComplete={completeChore} onEdit={openForm} onDelete={deleteChore} />)}
    <Section title="Completed" count={filtered.filter((chore) => chore.status === "Completed").length} />
    {filtered.filter((chore) => chore.status === "Completed").map((chore) => <ChoreCard key={chore.id} chore={chore} onComplete={completeChore} onEdit={openForm} onDelete={deleteChore} />)}
    {!filtered.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No chores here yet</Text><Text style={styles.emptyText}>Try changing filters or create the first chore for your home.</Text><Pressable onPress={() => openForm()} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create first chore</Text></Pressable></View> : null}
  </ScrollView></View>;
}

function Filter({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <Pressable onPress={() => onChange(options[(options.indexOf(value) + 1) % options.length])} style={styles.filter}><Text style={styles.filterText}>{value} ▾</Text></Pressable>; }
function ChoiceRow({ values, selected, onChange }: { values: string[]; selected: string; onChange: (value: string) => void }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>{values.map((value) => <Pressable key={value} onPress={() => onChange(value)} style={[styles.choice, selected === value && styles.choiceSelected]}><Text style={[styles.choiceText, selected === value && styles.choiceTextSelected]}>{value}</Text></Pressable>)}</ScrollView>; }
function Section({ title, count }: { title: string; count: number }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.count}>{count}</Text></View>; }
function ChoreCard({ chore, onComplete, onEdit, onDelete }: { chore: Chore; onComplete: (chore: Chore) => void; onEdit: (chore: Chore) => void; onDelete: (id: string) => void }) { const overdue = chore.status === "Active" && chore.due === "Sep 4"; return <View style={[styles.card, overdue && styles.overdueCard]}><View style={styles.cardHeader}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{chore.title}</Text>{chore.description ? <Text style={styles.description}>{chore.description}</Text> : null}</View><Text style={[styles.priority, chore.priority === "High" && styles.highPriority]}>{chore.priority}</Text></View><Text style={[styles.meta, overdue && styles.overdueText]}>{overdue ? "Overdue · " : ""}{chore.due} · {chore.assignee}</Text>{chore.recurrence !== "Once" ? <Text style={styles.repeat}>↻ {chore.recurrence}{chore.rotation.length > 1 ? ` · rotates: ${chore.rotation.join(" → ")}` : ""}</Text> : null}{chore.status === "Completed" ? <Text style={styles.completed}>Completed by {chore.completedBy} · {chore.completedAt}</Text> : <View style={styles.actions}><Pressable onPress={() => onComplete(chore)} style={styles.completeButton}><Text style={styles.completeText}>Mark complete</Text></Pressable><Pressable onPress={() => onEdit(chore)}><Text style={styles.textAction}>Edit</Text></Pressable><Pressable onPress={() => onDelete(chore.id)}><Text style={styles.deleteAction}>Delete</Text></Pressable></View>}</View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF" }, content: { padding: 20, paddingTop: 66, paddingBottom: 34 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }, eyebrow: { color: "#28634E", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }, title: { color: "#18251F", fontSize: 30, fontWeight: "800", marginTop: 3 }, intro: { color: "#64716B", marginTop: 6 }, addButton: { backgroundColor: "#28634E", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }, addButtonText: { color: "white", fontWeight: "800" }, filterLabel: { color: "#18251F", fontWeight: "800", marginTop: 24, marginBottom: 8 }, filterRow: { gap: 8 }, filter: { borderRadius: 18, borderWidth: 1, borderColor: "#D3DCD5", backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 8 }, filterText: { color: "#28634E", fontWeight: "700", fontSize: 12 }, form: { backgroundColor: "white", borderRadius: 18, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#E4E8E3" }, formTitle: { color: "#18251F", fontSize: 19, fontWeight: "800", marginBottom: 12 }, input: { borderWidth: 1, borderColor: "#E4E8E3", backgroundColor: "#FBFCFA", borderRadius: 10, padding: 12, marginBottom: 10, color: "#18251F" }, fieldLabel: { color: "#18251F", fontWeight: "800", fontSize: 13, marginTop: 5, marginBottom: 7 }, hint: { color: "#64716B", fontSize: 12, lineHeight: 17, marginTop: -3, marginBottom: 8 }, choiceRow: { gap: 7, paddingBottom: 7 }, choice: { borderWidth: 1, borderColor: "#D3DCD5", borderRadius: 17, paddingVertical: 7, paddingHorizontal: 10 }, choiceSelected: { backgroundColor: "#DDF0E5", borderColor: "#28634E" }, choiceText: { color: "#64716B", fontSize: 12, fontWeight: "700" }, choiceTextSelected: { color: "#28634E" }, memberGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }, memberButton: { borderWidth: 1, borderColor: "#D3DCD5", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }, memberButtonSelected: { backgroundColor: "#DDF0E5", borderColor: "#28634E" }, memberText: { color: "#64716B", fontSize: 12, fontWeight: "700" }, memberTextSelected: { color: "#28634E" }, formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 8 }, cancelButton: { padding: 11 }, cancelText: { color: "#64716B", fontWeight: "800" }, saveButton: { backgroundColor: "#28634E", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 }, saveText: { color: "white", fontWeight: "800" }, section: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 25, marginBottom: 9 }, sectionTitle: { color: "#18251F", fontSize: 18, fontWeight: "800" }, count: { color: "#64716B", fontSize: 12, fontWeight: "800", backgroundColor: "#E7ECE8", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }, card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 16, padding: 15, marginBottom: 10 }, overdueCard: { backgroundColor: "#FFF8F0", borderColor: "#F4CFAB" }, cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, cardCopy: { flex: 1 }, cardTitle: { color: "#18251F", fontSize: 16, fontWeight: "800" }, description: { color: "#64716B", fontSize: 13, marginTop: 3 }, priority: { color: "#64716B", fontWeight: "800", fontSize: 11, backgroundColor: "#EEF1EE", alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }, highPriority: { color: "#9C4C1B", backgroundColor: "#FFE5D5" }, meta: { color: "#64716B", fontSize: 13, marginTop: 11 }, overdueText: { color: "#B9652C", fontWeight: "700" }, repeat: { color: "#28634E", fontSize: 12, marginTop: 6 }, actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 13 }, completeButton: { backgroundColor: "#DDF0E5", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, completeText: { color: "#28634E", fontSize: 12, fontWeight: "800" }, textAction: { color: "#28634E", fontWeight: "800", fontSize: 12 }, deleteAction: { color: "#B65A50", fontWeight: "800", fontSize: 12 }, completed: { color: "#47755E", fontSize: 12, fontWeight: "700", marginTop: 10 }, empty: { borderStyle: "dashed", borderWidth: 1, borderColor: "#B9C5BD", borderRadius: 16, backgroundColor: "white", padding: 25, alignItems: "center" }, emptyTitle: { color: "#18251F", fontWeight: "800", fontSize: 16 }, emptyText: { color: "#64716B", textAlign: "center", marginTop: 6, lineHeight: 19 }, emptyButton: { backgroundColor: "#DDF0E5", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14 }, emptyButtonText: { color: "#28634E", fontWeight: "800", fontSize: 12 } });
