import { router, type Href } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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

export default function PaymentsScreen() {
  const { room, user } = useRoom();
  if (!room || !user) return null;
  return (
    <PaymentsContent
      members={room.members}
      roomId={room.room.id}
      roomName={room.room.name}
      userId={user.id}
    />
  );
}

function PaymentsContent({
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
  const { expenses, loading, error, refresh } = useExpenses(roomId, userId);
  const memberName = (id: string) =>
    members.find((m) => m.userId === id)?.displayName ?? "Former member";

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        onRefresh={() => void refresh()}
        refreshing={loading}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>{roomName.toUpperCase()}</Text>
                <Text style={styles.title}>Payments</Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push("/(room)/scan-receipt")}
              style={styles.scanButton}
            >
              <Text style={styles.scanText}>Scan a receipt</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(room)/review-receipt")}
              style={styles.manualButton}
            >
              <Text style={styles.manualText}>Add a receipt manually</Text>
            </Pressable>

            {error ? <Text style={styles.error}>Couldn't load payments: {error}</Text> : null}

            <Text style={styles.section}>Receipts</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#28634E" style={styles.loading} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No receipts yet</Text>
              <Text style={styles.emptyBody}>
                Scan or manually add a receipt to start splitting expenses with your roommates.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ExpenseRow expense={item} memberName={memberName} />
        )}
      />
    </SafeAreaView>
  );
}

function ExpenseRow({
  expense,
  memberName,
}: {
  expense: Expense;
  memberName: (id: string) => string;
}) {
  const date = new Date(expense.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <Pressable
      onPress={() => router.push(`/(room)/expense/${expense.id}` as Href)}
      style={styles.expense}
    >
      <View style={styles.expenseMain}>
        <Text style={styles.expenseTitle}>{expense.merchant || "Receipt"}</Text>
        <Text style={styles.expenseMeta}>
          Paid by {memberName(expense.paidBy)}
          {dateLabel ? ` · ${dateLabel}` : ""} · {expense.participants.length} splitting
        </Text>
      </View>
      <Text style={styles.expenseAmount}>{formatCents(expense.totalCents)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF" },
  list: { padding: 24, paddingTop: 60, paddingBottom: 48, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: "#6E7F69", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#20231F", fontSize: 32, fontWeight: "800", marginTop: 5 },
  scanButton: { backgroundColor: "#263D2C", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 20 },
  scanText: { color: "#FFFDF8", fontWeight: "800" },
  manualButton: { borderWidth: 1, borderColor: "#28634E", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 10 },
  manualText: { color: "#28634E", fontWeight: "800" },
  error: { color: "#A13D32", fontSize: 12, lineHeight: 18, marginTop: 12 },
  section: { color: "#73776D", fontSize: 12, fontWeight: "800", letterSpacing: 1.1, marginTop: 26, marginBottom: 10, textTransform: "uppercase" },
  balancesEmpty: { backgroundColor: "#FFFDF8", borderColor: "#ECE9DF", borderWidth: 1, borderRadius: 14, padding: 18 },
  balancesEmptyText: { color: "#777970", fontSize: 13 },
  balancesBox: { backgroundColor: "#FFFDF8", borderColor: "#ECE9DF", borderWidth: 1, borderRadius: 14, paddingHorizontal: 6, paddingVertical: 4 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 12 },
  balanceText: { color: "#252821", fontWeight: "700", fontSize: 14 },
  balanceAmount: { fontWeight: "800", fontSize: 15 },
  green: { color: "#2F7A4D" },
  rose: { color: "#A6675E" },
  loading: { marginTop: 40 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { color: "#252821", fontSize: 18, fontWeight: "800" },
  emptyBody: { color: "#777970", fontSize: 13, textAlign: "center", marginTop: 8, maxWidth: 300 },
  expense: { backgroundColor: "#FFFDF8", borderColor: "#ECE9DF", borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  expenseMain: { flex: 1 },
  expenseTitle: { color: "#252821", fontWeight: "800", fontSize: 16 },
  expenseMeta: { color: "#888B81", fontSize: 11, marginTop: 4 },
  expenseAmount: { color: "#29332A", fontWeight: "800", fontSize: 15 },
});
