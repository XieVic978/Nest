import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRoom } from "@/features/rooms/RoomProvider";
import type { RoomMember } from "@/features/rooms/types";
import type { ExpenseInput } from "@/features/shared-data/useExpenses";
import { useExpenses } from "@/features/shared-data/useExpenses";
import type { ExpensePaymentStatus, NestExpense } from "@/features/shared-data/types";

const CATEGORIES = ["Food", "Utilities", "Rent", "Transport", "Other"] as const;

function messageFrom(caught: unknown) {
  return typeof caught === "object" && caught && "message" in caught
    ? String(caught.message)
    : "Please try again.";
}

export default function Expenses() {
  const { room, user } = useRoom();

  if (!room || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Join a Nest to share expenses</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ExpensesContent
      members={room.members}
      roomId={room.room.id}
      roomName={room.room.name}
      userId={user.id}
    />
  );
}

function ExpensesContent({
  members,
  roomId,
  roomName,
  userId,
}: {
  members: RoomMember[];
  roomId: string;
  roomName: string;
  userId: string;
}) {
  const { createExpense, error, expenses, loading, refresh, setPaymentStatus } = useExpenses(roomId);
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members],
  );
  const currentUserName = memberNames.get(userId) ?? "You";

  const visibleExpenses = categoryFilter === "All"
    ? expenses
    : expenses.filter((expense) => expense.category === categoryFilter);

  const netBalance = useMemo(() => expenses.reduce((balance, expense) => {
    const share = expense.amount / expense.participants.length;
    if (expense.payerUserId === userId) {
      const openShares = expense.participants.filter(
        (participant) => participant.userId !== userId && participant.paymentStatus !== "confirmed",
      ).length;
      return balance + share * openShares;
    }

    const currentParticipant = expense.participants.find((participant) => participant.userId === userId);
    return currentParticipant && currentParticipant.paymentStatus !== "confirmed"
      ? balance - share
      : balance;
  }, 0), [expenses, userId]);

  const updatePayment = async (
    expenseId: string,
    participantUserId: string,
    status: ExpensePaymentStatus,
  ) => {
    try {
      await setPaymentStatus(expenseId, participantUserId, status);
    } catch (caught) {
      Alert.alert("Couldn’t update payment", messageFrom(caught));
    }
  };

  const saveExpense = async (input: ExpenseInput) => {
    try {
      await createExpense(input);
      setModalVisible(false);
      return true;
    } catch (caught) {
      Alert.alert("Couldn’t save expense", messageFrom(caught));
      return false;
    }
  };

  const owe = Math.max(0, -netBalance);
  const owed = Math.max(0, netBalance);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={(
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor="#28634E"
          />
        )}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{roomName.toUpperCase()}</Text>
            <Text style={styles.title}>Shared expenses</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{currentUserName.slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.balanceGrid}>
          <Balance label="What I owe" amount={owe} tone="rose" />
          <Balance label="Owed to me" amount={owed} tone="green" />
        </View>

        <Pressable onPress={() => setModalVisible(true)} style={styles.add}>
          <Text style={styles.addText}>+ Add expense</Text>
        </Pressable>

        <Text style={styles.section}>Transaction log</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {["All", ...CATEGORIES].map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setCategoryFilter(filter)}
              style={[styles.filter, categoryFilter === filter && styles.filterSelected]}
            >
              <Text style={[styles.filterText, categoryFilter === filter && styles.filterTextSelected]}>
                {filter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>Couldn’t load shared expenses: {error}</Text> : null}
        {loading && !expenses.length ? <ActivityIndicator color="#28634E" style={styles.loading} /> : null}
        {!loading && !visibleExpenses.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No shared expenses yet</Text>
            <Text style={styles.emptyBody}>Record a bill and choose which roommates should split it.</Text>
          </View>
        ) : visibleExpenses.map((expense) => (
          <ExpenseRow
            key={expense.id}
            expense={expense}
            memberNames={memberNames}
            currentUserId={userId}
            onSetStatus={updatePayment}
          />
        ))}

        <ExpenseForm
          visible={modalVisible}
          members={members}
          currentUserId={userId}
          onClose={() => setModalVisible(false)}
          onSave={saveExpense}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Balance({ label, amount, tone }: { label: string; amount: number; tone: "rose" | "green" }) {
  return (
    <View style={[styles.balance, tone === "rose" ? styles.rose : styles.green]}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={styles.balanceAmount}>${amount.toFixed(2)}</Text>
      <Text style={styles.balanceHint}>{amount ? "across open bills" : "all clear"}</Text>
    </View>
  );
}

function ExpenseRow({
  expense,
  memberNames,
  currentUserId,
  onSetStatus,
}: {
  expense: NestExpense;
  memberNames: Map<string, string>;
  currentUserId: string;
  onSetStatus: (expenseId: string, participantUserId: string, status: ExpensePaymentStatus) => Promise<void>;
}) {
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const share = expense.amount / expense.participants.length;
  const currentPayment = expense.participants.find(
    (participant) => participant.userId === currentUserId,
  )?.paymentStatus;
  const isReceiver = expense.payerUserId === currentUserId;
  const isDebtor = Boolean(currentPayment) && !isReceiver;
  const pendingPayers = expense.participants.filter(
    (participant) => participant.userId !== expense.payerUserId && participant.paymentStatus === "pending",
  );
  const displayName = (participantUserId: string) => memberNames.get(participantUserId) ?? "Former member";

  const changeStatus = async (participantUserId: string, status: ExpensePaymentStatus) => {
    setBusyUserId(participantUserId);
    try {
      await onSetStatus(expense.id, participantUserId, status);
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <View style={styles.expense}>
      <View style={styles.expenseTop}>
        <View style={styles.expenseIcon}><Text>↗</Text></View>
        <View style={styles.expenseMain}>
          <Text style={styles.expenseTitle}>{expense.title}</Text>
          <Text style={styles.expenseMeta}>
            {expense.category} · {expense.date} · Paid by {displayName(expense.payerUserId)}
          </Text>
        </View>
        <Text style={styles.amount}>${expense.amount.toFixed(2)}</Text>
      </View>

      <Text style={styles.split}>
        {expense.participants.map((participant) => displayName(participant.userId)).join(", ")} · ${share.toFixed(2)} each
      </Text>
      {expense.description ? <Text style={styles.description}>{expense.description}</Text> : null}

      {isDebtor ? (
        <View style={styles.expenseBottom}>
          {currentPayment === "open" ? (
            <Pressable
              disabled={busyUserId === currentUserId}
              onPress={() => void changeStatus(currentUserId, "pending")}
              style={styles.settle}
            >
              <Text style={styles.settleText}>
                {busyUserId === currentUserId ? "Updating…" : "Mark as paid"}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.status, currentPayment === "confirmed" && styles.settled]}>
              {currentPayment === "pending" ? "Awaiting recipient confirmation" : "Payment confirmed"}
            </Text>
          )}
        </View>
      ) : null}

      {isReceiver && pendingPayers.map((participant) => (
        <View key={participant.userId} style={styles.expenseBottom}>
          <Text style={styles.expenseMeta}>
            {displayName(participant.userId)} marked ${share.toFixed(2)} as paid
          </Text>
          <Pressable
            disabled={busyUserId === participant.userId}
            onPress={() => void changeStatus(participant.userId, "confirmed")}
            style={styles.settle}
          >
            <Text style={styles.settleText}>Confirm</Text>
          </Pressable>
          <Pressable
            disabled={busyUserId === participant.userId}
            onPress={() => void changeStatus(participant.userId, "open")}
            style={styles.filter}
          >
            <Text style={styles.filterText}>Not received</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function ExpenseForm({
  visible,
  members,
  currentUserId,
  onClose,
  onSave,
}: {
  visible: boolean;
  members: RoomMember[];
  currentUserId: string;
  onClose: () => void;
  onSave: (expense: ExpenseInput) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Food");
  const [payerUserId, setPayerUserId] = useState(currentUserId);
  const [description, setDescription] = useState("");
  const [participantUserIds, setParticipantUserIds] = useState<string[]>([currentUserId]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPayerUserId(currentUserId);
      setParticipantUserIds([currentUserId]);
    }
  }, [currentUserId, visible]);

  const toggleParticipant = (participantUserId: string) => {
    setParticipantUserIds((current) => current.includes(participantUserId)
      ? current.filter((entry) => entry !== participantUserId)
      : [...current, participantUserId]);
  };

  const submit = async () => {
    const numericAmount = Number(amount);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      && !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
    const selectedPeople = participantUserIds.includes(payerUserId)
      ? participantUserIds
      : [...participantUserIds, payerUserId];

    if (!title.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0 || !validDate || !payerUserId) {
      Alert.alert("Complete the expense", "Add a title, positive amount, valid date, and payer.");
      return;
    }

    setSaving(true);
    try {
      const saved = await onSave({
        title: title.trim(),
        amount: numericAmount,
        date,
        category,
        description: description.trim(),
        payerUserId,
        participantUserIds: selectedPeople,
      });
      if (saved) {
        setTitle("");
        setAmount("");
        setDescription("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add expense</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>Close</Text></Pressable>
          </View>
          <ScrollView>
            <Text style={styles.label}>TITLE</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Internet bill" style={styles.input} />
            <Text style={styles.label}>AMOUNT</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" style={styles.input} />
            <Text style={styles.label}>DATE</Text>
            <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} />
            <Text style={styles.label}>CATEGORY</Text>
            <ScrollView horizontal contentContainerStyle={styles.filters}>
              {CATEGORIES.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setCategory(option)}
                  style={[styles.filter, category === option && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, category === option && styles.filterTextSelected]}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>PAID BY</Text>
            <PeoplePicker members={members} selected={payerUserId} onSelect={setPayerUserId} />
            <Text style={styles.label}>SPLIT WITH</Text>
            <View style={styles.people}>
              {members.map((member) => (
                <Pressable
                  key={member.userId}
                  onPress={() => toggleParticipant(member.userId)}
                  style={[styles.person, participantUserIds.includes(member.userId) && styles.personSelected]}
                >
                  <Text style={styles.personText}>{member.displayName}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Optional note" style={[styles.input, styles.descriptionInput]} multiline />
            <Pressable disabled={saving} onPress={() => void submit()} style={[styles.save, saving && styles.disabled]}>
              <Text style={styles.saveText}>{saving ? "Saving…" : "Save expense"}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PeoplePicker({
  members,
  selected,
  onSelect,
}: {
  members: RoomMember[];
  selected: string;
  onSelect: (userId: string) => void;
}) {
  return (
    <View style={styles.people}>
      {members.map((member) => (
        <Pressable
          key={member.userId}
          onPress={() => onSelect(member.userId)}
          style={[styles.person, selected === member.userId && styles.personSelected]}
        >
          <Text style={styles.personText}>{member.displayName}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F5EF" },
  screen: { padding: 24, paddingBottom: 50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: Platform.OS === "web" ? 16 : 0 },
  eyebrow: { color: "#6E7F69", fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  title: { color: "#20231F", fontSize: 32, fontWeight: "800", marginTop: 5 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#D4E0C6", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#35513A", fontWeight: "800", fontSize: 17 },
  balanceGrid: { flexDirection: "row", gap: 12, marginTop: 22 },
  balance: { flex: 1, borderRadius: 16, padding: 16 },
  rose: { backgroundColor: "#F1E1DA" },
  green: { backgroundColor: "#E4EAD9" },
  balanceLabel: { color: "#60645B", fontSize: 12, fontWeight: "700" },
  balanceAmount: { color: "#29332A", fontSize: 25, fontWeight: "800", marginTop: 9 },
  balanceHint: { color: "#7D8176", fontSize: 11, marginTop: 3 },
  add: { backgroundColor: "#263D2C", padding: 15, borderRadius: 12, alignItems: "center", marginTop: 14 },
  addText: { color: "#FFFDF8", fontWeight: "800" },
  section: { color: "#73776D", fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginTop: 27, marginBottom: 10, textTransform: "uppercase" },
  filters: { gap: 8, paddingBottom: 12 },
  filter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: "#D8D9CF" },
  filterSelected: { backgroundColor: "#DCE8D3", borderColor: "#8FA584" },
  filterText: { color: "#73776D", fontSize: 12, fontWeight: "700" },
  filterTextSelected: { color: "#35513A" },
  error: { color: "#A13D32", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  loading: { marginTop: 45 },
  expense: { backgroundColor: "#FFFDF8", borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: "#ECE9DF" },
  expenseTop: { flexDirection: "row", alignItems: "center" },
  expenseIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#E8F0E1", alignItems: "center", justifyContent: "center" },
  expenseMain: { flex: 1, marginLeft: 10 },
  expenseTitle: { color: "#252821", fontWeight: "800", fontSize: 16 },
  expenseMeta: { color: "#888B81", fontSize: 11, marginTop: 3, flex: 1 },
  amount: { color: "#29332A", fontWeight: "800" },
  split: { color: "#596156", fontSize: 12, marginTop: 13 },
  description: { color: "#777970", fontSize: 12, marginTop: 7 },
  expenseBottom: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 13 },
  status: { color: "#A6675E", fontSize: 11, fontWeight: "800" },
  settled: { color: "#577050" },
  settle: { backgroundColor: "#E8F0E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  settleText: { color: "#577050", fontSize: 12, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 55 },
  emptyTitle: { color: "#252821", fontSize: 18, fontWeight: "800" },
  emptyBody: { color: "#777970", fontSize: 13, textAlign: "center", marginTop: 8 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,34,27,.35)" },
  sheet: { backgroundColor: "#F7F5EF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  modalTitle: { color: "#252821", fontSize: 24, fontWeight: "800" },
  close: { color: "#577050", fontWeight: "700" },
  label: { color: "#777970", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 11, marginBottom: 7 },
  input: { backgroundColor: "#FFFDF8", borderColor: "#E1DED3", borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 15, color: "#252821" },
  people: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  person: { borderWidth: 1, borderColor: "#D8D9CF", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 9 },
  personSelected: { backgroundColor: "#DCE8D3", borderColor: "#8FA584" },
  personText: { color: "#596156", fontWeight: "700", fontSize: 12 },
  descriptionInput: { minHeight: 65, textAlignVertical: "top" },
  save: { backgroundColor: "#263D2C", padding: 15, borderRadius: 12, alignItems: "center", marginTop: 22, marginBottom: 12 },
  saveText: { color: "#FFFDF8", fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
