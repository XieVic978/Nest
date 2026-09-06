import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRoom } from "@/features/rooms/RoomProvider";
import type { RoomMember } from "@/features/rooms/types";
import { centsToDollars, dollarsToCents, formatCents } from "@/features/expenses/money";
import { computeSplit } from "@/features/expenses/split";
import type { DraftItem } from "@/features/expenses/types";
import { uploadReceiptImage, scanReceipt } from "@/features/expenses/receiptScan";
import { useExpenses } from "@/features/expenses/useExpenses";

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function messageFrom(caught: unknown) {
  return typeof caught === "object" && caught && "message" in caught
    ? String((caught as { message: unknown }).message)
    : "Please try again.";
}

export default function ReviewReceiptScreen() {
  const { room, user } = useRoom();
  const params = useLocalSearchParams<{ photoUri?: string }>();
  if (!room || !user) return null;
  return (
    <ReviewContent
      members={room.members}
      roomId={room.room.id}
      userId={user.id}
      photoUri={typeof params.photoUri === "string" ? params.photoUri : null}
    />
  );
}

type CentsField = { text: string; cents: number };

function field(cents: number): CentsField {
  return { text: centsToDollars(cents), cents };
}

function ReviewContent({
  members,
  roomId,
  userId,
  photoUri,
}: {
  members: RoomMember[];
  roomId: string;
  userId: string;
  photoUri: string | null;
}) {
  const { saveExpense } = useExpenses(roomId, userId);

  const [scanning, setScanning] = useState(Boolean(photoUri));
  const [scanFailed, setScanFailed] = useState(false);
  const [scanErrorDetail, setScanErrorDetail] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  const [merchant, setMerchant] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [subtotal, setSubtotal] = useState<CentsField>(field(0));
  const [tax, setTax] = useState<CentsField>(field(0));
  const [tip, setTip] = useState<CentsField>(field(0));
  const [total, setTotal] = useState<CentsField>(field(0));

  const [paidByUserId, setPaidByUserId] = useState(userId);
  const [participantIds, setParticipantIds] = useState<string[]>(
    members.map((m) => m.userId)
  );
  const [saving, setSaving] = useState(false);

  const memberName = (id: string) =>
    id === userId ? "You" : members.find((m) => m.userId === id)?.displayName ?? "Roommate";

  // Upload + OCR on mount when a photo was captured. Failures fall back to
  // manual entry rather than blocking the flow.
  useEffect(() => {
    let active = true;
    if (!photoUri) return;
    (async () => {
      try {
        const path = await uploadReceiptImage(roomId, photoUri);
        if (active) setUploadedPath(path);
        const result = await scanReceipt(path);
        if (!active) return;
        setMerchant(result.merchant);
        setItems(
          result.items.map((it) => ({
            key: newKey(),
            name: it.name,
            quantity: it.quantity,
            lineTotalCents: it.lineTotalCents,
            assignedToUserId: null,
          }))
        );
        setSubtotal(field(result.subtotalCents));
        setTax(field(result.taxCents));
        setTip(field(result.tipCents));
        setTotal(field(result.totalCents));
      } catch (caught) {
        const detail = messageFrom(caught);
        console.warn("[Nest] Receipt scan failed:", detail);
        if (active) {
          setScanFailed(true);
          setScanErrorDetail(detail);
        }
      } finally {
        if (active) setScanning(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [photoUri, roomId]);

  const itemsTotalCents = useMemo(
    () => items.reduce((sum, it) => sum + it.lineTotalCents, 0),
    [items]
  );

  // Live split preview (also used to gate saving).
  const split = useMemo(
    () =>
      computeSplit({
        totalCents: total.cents,
        participantIds,
        items: items.map((it) => ({
          lineTotalCents: it.lineTotalCents,
          assignedToUserId: it.assignedToUserId,
        })),
      }),
    [total.cents, participantIds, items]
  );

  const totalMismatch = items.length > 0 && itemsTotalCents !== total.cents;

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((cur) => cur.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function deleteItem(key: string) {
    setItems((cur) => cur.filter((it) => it.key !== key));
  }
  function addItem() {
    setItems((cur) => [
      ...cur,
      { key: newKey(), name: "", quantity: 1, lineTotalCents: 0, assignedToUserId: null },
    ]);
  }
  function toggleParticipant(id: string) {
    setParticipantIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next;
    });
    // If we removed the payer or an item assignee, keep data consistent.
    setItems((cur) =>
      cur.map((it) =>
        it.assignedToUserId === id && cur.length
          ? it.assignedToUserId && !participantIds.includes(id)
            ? it
            : it
          : it
      )
    );
  }

  async function handleSave() {
    if (participantIds.length === 0) {
      Alert.alert("Pick roommates", "Choose at least one roommate to split with.");
      return;
    }
    if (!participantIds.includes(paidByUserId)) {
      Alert.alert("Payer not included", "The payer must be one of the selected roommates.");
      return;
    }
    if (!split.ok) {
      Alert.alert("Can't split this yet", split.error);
      return;
    }
    if (total.cents <= 0) {
      Alert.alert("Add a total", "Enter the receipt total before saving.");
      return;
    }
    // Any item assigned to a now-unselected roommate would silently become
    // shared; block it so the user resolves it explicitly.
    const orphaned = items.find(
      (it) => it.assignedToUserId && !participantIds.includes(it.assignedToUserId)
    );
    if (orphaned) {
      Alert.alert(
        "Reassign items",
        "An item is assigned to a roommate who isn't in the split. Reassign it or set it to Shared."
      );
      return;
    }

    try {
      setSaving(true);
      await saveExpense({
        merchant,
        purchasedAt: null,
        paidByUserId,
        participantIds,
        subtotalCents: subtotal.cents,
        taxCents: tax.cents,
        tipCents: tip.cents,
        totalCents: total.cents,
        items,
        receiptImagePath: uploadedPath,
      });
      router.replace("/(room)/payments");
    } catch (caught) {
      Alert.alert("Couldn't save expense", messageFrom(caught));
    } finally {
      setSaving(false);
    }
  }

  if (scanning) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#28634E" size="large" />
        <Text style={styles.scanText}>Reading your receipt…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.title}>Review receipt</Text>
          <Pressable onPress={() => router.back()}><Text style={styles.close}>Cancel</Text></Pressable>
        </View>

        {scanFailed ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Scan failed? Add items manually</Text>
            <Text style={styles.warnBody}>
              We couldn't read the receipt automatically. Enter the items and totals below.
            </Text>
            {scanErrorDetail ? (
              <Text style={styles.warnDetail}>Reason: {scanErrorDetail}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.label}>MERCHANT</Text>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder="e.g. Trader Joe's"
          style={styles.input}
        />

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Items</Text>
          <Pressable onPress={addItem} style={styles.addBtn}><Text style={styles.addText}>+ Add item</Text></Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.emptyItems}>No items yet. Add items, or just set the total below to split evenly.</Text>
        ) : (
          items.map((it) => (
            <ItemRow
              key={it.key}
              item={it}
              members={members}
              participantIds={participantIds}
              memberName={memberName}
              onChange={(patch) => updateItem(it.key, patch)}
              onDelete={() => deleteItem(it.key)}
            />
          ))
        )}

        {items.length > 0 ? (
          <Text style={styles.itemsSum}>Items add up to {formatCents(itemsTotalCents)}</Text>
        ) : null}

        <Text style={styles.section}>Totals</Text>
        <MoneyField label="SUBTOTAL" value={subtotal} onChange={setSubtotal} />
        <MoneyField label="TAX" value={tax} onChange={setTax} />
        <MoneyField label="TIP / FEES" value={tip} onChange={setTip} />
        <MoneyField label="GRAND TOTAL" value={total} onChange={setTotal} emphasize />

        {totalMismatch ? (
          <Text style={styles.mismatch}>
            Heads up: items ({formatCents(itemsTotalCents)}) don't match the grand total (
            {formatCents(total.cents)}). Tax, tip, and fees are shared, so some difference is normal.
          </Text>
        ) : null}

        <Text style={styles.section}>Paid by</Text>
        <View style={styles.chips}>
          {members.map((m) => (
            <Pressable
              key={m.userId}
              onPress={() => setPaidByUserId(m.userId)}
              style={[styles.chip, paidByUserId === m.userId && styles.chipOn]}
            >
              <Text style={[styles.chipText, paidByUserId === m.userId && styles.chipTextOn]}>
                {memberName(m.userId)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Split between</Text>
        <View style={styles.chips}>
          {members.map((m) => {
            const on = participantIds.includes(m.userId);
            return (
              <Pressable
                key={m.userId}
                onPress={() => toggleParticipant(m.userId)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{memberName(m.userId)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Each person owes</Text>
        {split.ok ? (
          <View style={styles.sharesBox}>
            {split.result.shares.map((s) => (
              <View key={s.userId} style={styles.shareRow}>
                <Text style={styles.shareName}>{memberName(s.userId)}</Text>
                <Text style={styles.shareAmount}>{formatCents(s.finalShareCents)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mismatch}>{split.error}</Text>
        )}

        <Pressable
          onPress={() => void handleSave()}
          disabled={saving || !split.ok}
          style={[styles.save, (saving || !split.ok) && styles.saveDisabled]}
        >
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save expense"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  emphasize,
}: {
  label: string;
  value: CentsField;
  onChange: (next: CentsField) => void;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.moneyRow}>
      <Text style={[styles.moneyLabel, emphasize && styles.moneyLabelStrong]}>{label}</Text>
      <View style={styles.moneyInputWrap}>
        <Text style={styles.dollar}>$</Text>
        <TextInput
          value={value.text}
          onChangeText={(text) => {
            const cents = dollarsToCents(text);
            onChange({ text, cents: cents ?? value.cents });
          }}
          onBlur={() => onChange(field(value.cents))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={[styles.moneyInput, emphasize && styles.moneyInputStrong]}
        />
      </View>
    </View>
  );
}

function ItemRow({
  item,
  members,
  participantIds,
  memberName,
  onChange,
  onDelete,
}: {
  item: DraftItem;
  members: RoomMember[];
  participantIds: string[];
  memberName: (id: string) => string;
  onChange: (patch: Partial<DraftItem>) => void;
  onDelete: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const assignedName = item.assignedToUserId ? memberName(item.assignedToUserId) : "Shared";
  const assignable = members.filter((m) => participantIds.includes(m.userId));

  return (
    <View style={styles.itemCard}>
      <TextInput
        value={item.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="Item name"
        style={styles.itemName}
      />
      <View style={styles.itemFields}>
        <View style={styles.qtyWrap}>
          <Text style={styles.miniLabel}>QTY</Text>
          <TextInput
            value={String(item.quantity)}
            onChangeText={(t) => {
              const q = parseInt(t.replace(/[^\d]/g, ""), 10);
              onChange({ quantity: Number.isFinite(q) && q >= 1 ? q : 1 });
            }}
            keyboardType="number-pad"
            style={styles.qtyInput}
          />
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.miniLabel}>LINE TOTAL</Text>
          <View style={styles.moneyInputWrap}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              defaultValue={centsToDollars(item.lineTotalCents)}
              onChangeText={(t) => {
                const cents = dollarsToCents(t);
                if (cents !== null) onChange({ lineTotalCents: cents });
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              style={styles.priceInput}
            />
          </View>
        </View>
      </View>

      <View style={styles.assignRow}>
        <Pressable onPress={() => setAssignOpen((v) => !v)} style={styles.assignBtn}>
          <Text style={styles.assignText}>{assignedName === "Shared" ? "Shared by all" : `Only ${assignedName}`} ▾</Text>
        </Pressable>
        <Pressable onPress={onDelete}><Text style={styles.deleteText}>Delete</Text></Pressable>
      </View>

      {assignOpen ? (
        <View style={styles.assignMenu}>
          <Pressable
            onPress={() => { onChange({ assignedToUserId: null }); setAssignOpen(false); }}
            style={[styles.assignOption, item.assignedToUserId === null && styles.assignOptionOn]}
          >
            <Text style={styles.assignOptionText}>Shared by all selected roommates</Text>
          </Pressable>
          {assignable.map((m) => (
            <Pressable
              key={m.userId}
              onPress={() => { onChange({ assignedToUserId: m.userId }); setAssignOpen(false); }}
              style={[styles.assignOption, item.assignedToUserId === m.userId && styles.assignOptionOn]}
            >
              <Text style={styles.assignOptionText}>Only {memberName(m.userId)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF" },
  center: { flex: 1, backgroundColor: "#F7F5EF", alignItems: "center", justifyContent: "center", gap: 12 },
  scanText: { color: "#52605A", fontWeight: "700" },
  content: { padding: 24, paddingBottom: 60 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#18251F", fontSize: 28, fontWeight: "800" },
  close: { color: "#28634E", fontWeight: "800" },
  warnBox: { backgroundColor: "#FBEEE7", borderRadius: 12, padding: 14, marginTop: 16 },
  warnTitle: { color: "#9C4C1B", fontWeight: "800" },
  warnBody: { color: "#8A6A57", fontSize: 13, marginTop: 4, lineHeight: 18 },
  warnDetail: { color: "#8A6A57", fontSize: 11, marginTop: 8, fontStyle: "italic" },
  label: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 18, marginBottom: 7 },
  input: { backgroundColor: "#FFFDF8", borderColor: "#E1DED3", borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 15, color: "#252821" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24 },
  section: { color: "#18251F", fontSize: 18, fontWeight: "800", marginTop: 24, marginBottom: 8 },
  addBtn: { backgroundColor: "#DDF0E5", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  addText: { color: "#28634E", fontWeight: "800", fontSize: 12 },
  emptyItems: { color: "#777970", fontSize: 13, lineHeight: 19, marginTop: 6 },
  itemsSum: { color: "#596156", fontSize: 12, fontWeight: "700", marginTop: 8 },
  itemCard: { backgroundColor: "#FFFDF8", borderColor: "#ECE9DF", borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#252821", borderBottomWidth: 1, borderColor: "#EFEDE4", paddingBottom: 8 },
  itemFields: { flexDirection: "row", gap: 12, marginTop: 10 },
  qtyWrap: { width: 70 },
  priceWrap: { flex: 1 },
  miniLabel: { color: "#96988E", fontSize: 10, fontWeight: "800", letterSpacing: 0.6, marginBottom: 4 },
  qtyInput: { backgroundColor: "#FFFDF8", borderColor: "#E1DED3", borderWidth: 1, borderRadius: 9, padding: 9, textAlign: "center", color: "#252821" },
  moneyInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFDF8", borderColor: "#E1DED3", borderWidth: 1, borderRadius: 9, paddingHorizontal: 10 },
  dollar: { color: "#96988E", fontWeight: "700" },
  priceInput: { flex: 1, padding: 9, color: "#252821" },
  assignRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  assignBtn: { backgroundColor: "#E8F0E1", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  assignText: { color: "#28634E", fontWeight: "800", fontSize: 12 },
  deleteText: { color: "#A6675E", fontWeight: "800", fontSize: 12 },
  assignMenu: { marginTop: 10, gap: 6 },
  assignOption: { borderWidth: 1, borderColor: "#D8D9CF", borderRadius: 9, padding: 10 },
  assignOptionOn: { backgroundColor: "#DCE8D3", borderColor: "#8FA584" },
  assignOptionText: { color: "#596156", fontWeight: "700", fontSize: 13 },
  moneyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  moneyLabel: { color: "#777970", fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  moneyLabelStrong: { color: "#18251F", fontSize: 14 },
  moneyInput: { padding: 9, minWidth: 90, textAlign: "right", color: "#252821" },
  moneyInputStrong: { fontWeight: "800" },
  mismatch: { color: "#9C4C1B", fontSize: 12.5, lineHeight: 18, marginTop: 10, backgroundColor: "#FBEEE7", borderRadius: 10, padding: 11 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#D8D9CF", borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 },
  chipOn: { backgroundColor: "#DCE8D3", borderColor: "#8FA584" },
  chipText: { color: "#596156", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#35513A" },
  sharesBox: { backgroundColor: "#FFFDF8", borderColor: "#ECE9DF", borderWidth: 1, borderRadius: 14, padding: 6 },
  shareRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 9 },
  shareName: { color: "#252821", fontWeight: "700" },
  shareAmount: { color: "#28634E", fontWeight: "800" },
  save: { backgroundColor: "#263D2C", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 26 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: "#FFFDF8", fontWeight: "800", fontSize: 15 },
});
