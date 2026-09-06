import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRoom } from "@/features/rooms/RoomProvider";
import type { RoomMember } from "@/features/rooms/types";
import { formatCents } from "@/features/expenses/money";
import type { Expense } from "@/features/expenses/types";
import { useExpenses } from "@/features/expenses/useExpenses";

export default function ExpenseDetailScreen() {
  const { room, user } = useRoom();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!room || !user) return null;
  return (
    <ExpenseDetailContent
      members={room.members}
      roomId={room.room.id}
      userId={user.id}
      expenseId={typeof id === "string" ? id : ""}
    />
  );
}

function ExpenseDetailContent({
  members,
  roomId,
  userId,
  expenseId,
}: {
  members: RoomMember[];
  roomId: string;
  userId: string;
  expenseId: string;
}) {
  const { expenses, loading, deleteExpense, getReceiptUrl } = useExpenses(roomId, userId);
  const expense = useMemo<Expense | undefined>(
    () => expenses.find((e) => e.id === expenseId),
    [expenses, expenseId]
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const memberName = (id: string) =>
    id === userId ? "You" : members.find((m) => m.userId === id)?.displayName ?? "Former member";

  useEffect(() => {
    let active = true;
    if (expense?.receiptImagePath) {
      void getReceiptUrl(expense.receiptImagePath).then((url) => {
        if (active) setImageUrl(url);
      });
    }
    return () => {
      active = false;
    };
  }, [expense?.receiptImagePath, getReceiptUrl]);

  function confirmDelete() {
    const perform = () =>
      void deleteExpense(expenseId)
        .then(() => router.back())
        .catch((caught) =>
          Alert.alert(
            "Couldn't delete",
            typeof caught === "object" && caught && "message" in caught
              ? String((caught as { message: unknown }).message)
              : "Please try again."
          )
        );
    if (Platform.OS === "web") {
      if (globalThis.confirm("Delete this expense for everyone?")) perform();
      return;
    }
    Alert.alert("Delete expense?", "This removes it and its balances for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: perform },
    ]);
  }

  if (loading && !expense) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#28634E" size="large" />
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Expense not found</Text>
        <Pressable onPress={() => router.back()} style={styles.linkBtn}>
          <Text style={styles.link}>Back to Payments</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{expense.merchant || "Receipt"}</Text>
          <Pressable onPress={() => router.back()}><Text style={styles.close}>Back</Text></Pressable>
        </View>
        <Text style={styles.subtitle}>
          Paid by {memberName(expense.paidBy)} · Total {formatCents(expense.totalCents)}
        </Text>

        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.receiptImage} resizeMode="contain" />
        ) : null}

        <Text style={styles.section}>Items</Text>
        {expense.items.length === 0 ? (
          <Text style={styles.muted}>No individual items — split by total.</Text>
        ) : (
          <View style={styles.box}>
            {expense.items.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{it.name || "Item"}{it.quantity > 1 ? ` ×${it.quantity}` : ""}</Text>
                  <Text style={styles.itemAssign}>
                    {it.assignedToUserId ? `Only ${memberName(it.assignedToUserId)}` : "Shared"}
                  </Text>
                </View>
                <Text style={styles.itemAmount}>{formatCents(it.lineTotalCents)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.section}>Totals</Text>
        <View style={styles.box}>
          <Line label="Subtotal" value={expense.subtotalCents} />
          <Line label="Tax" value={expense.taxCents} />
          <Line label="Tip / fees" value={expense.tipCents} />
          <Line label="Grand total" value={expense.totalCents} strong />
        </View>

        <Text style={styles.section}>Each person's share</Text>
        <View style={styles.box}>
          {expense.participants.map((p) => (
            <View key={p.userId} style={styles.itemRow}>
              <Text style={styles.itemName}>{memberName(p.userId)}</Text>
              <Text style={styles.itemAmount}>{formatCents(p.finalShareCents)}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete expense</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={styles.itemRow}>
      <Text style={[styles.itemName, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.itemAmount, strong && styles.strong]}>{formatCents(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF" },
  center: { flex: 1, backgroundColor: "#F7F5EF", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  content: { padding: 24, paddingBottom: 50 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#18251F", fontSize: 26, fontWeight: "800", flex: 1 },
  close: { color: "#28634E", fontWeight: "800" },
  subtitle: { color: "#64716B", fontSize: 13, marginTop: 6 },
  receiptImage: { width: "100%", height: 260, borderRadius: 14, marginTop: 16, backgroundColor: "#EDEAE0" },
  section: { color: "#73776D", fontSize: 12, fontWeight: "800", letterSpacing: 1.1, marginTop: 24, marginBottom: 10, textTransform: "uppercase" },
  muted: { color: "#777970", fontSize: 13 },
  box: { backgroundColor: "#FFFDF8", borderColor: "#ECE9DF", borderWidth: 1, borderRadius: 14, paddingHorizontal: 6, paddingVertical: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 11 },
  itemMain: { flex: 1 },
  itemName: { color: "#252821", fontWeight: "700", fontSize: 14 },
  itemAssign: { color: "#7D8781", fontSize: 11, marginTop: 2 },
  itemAmount: { color: "#29332A", fontWeight: "800" },
  strong: { color: "#18251F", fontSize: 15 },
  deleteBtn: { borderWidth: 1, borderColor: "#D9B4AC", backgroundColor: "#F6E8E5", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 28 },
  deleteText: { color: "#A6675E", fontWeight: "800" },
  linkBtn: { padding: 8 },
  link: { color: "#28634E", fontWeight: "800" },
  emptyTitle: { color: "#18251F", fontSize: 18, fontWeight: "800" },
});
