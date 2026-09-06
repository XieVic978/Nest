import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useRoom } from "@/features/rooms/RoomProvider";
import { ReceiptForm } from "../expenses";
import type { ReceiptExpenseInput } from "@/features/shared-data/useExpenses";
import { useExpenses } from "@/features/shared-data/useExpenses";

export default function ReviewGroceryScreen() {
  const isFocused = useIsFocused();
  const { room } = useRoom();
  const { date, imagePath, items, photoName, photoUri, title } = useLocalSearchParams<{ date?: string; imagePath?: string; items?: string; photoName?: string; photoUri?: string; title?: string }>();
  const { createReceiptExpense } = useExpenses(room?.room.id ?? "");
  if (!room) return null;
  const close = () => router.replace("/(room)/payments");
  const save = async (input: ReceiptExpenseInput) => { await createReceiptExpense(input); return true; };
  let scannedItems: { name: string; amount: number }[] = [];
  try { scannedItems = items ? JSON.parse(items) : []; } catch { scannedItems = []; }
  return <ReceiptForm visible={isFocused} members={room.members} photoName={photoName} photoUri={photoUri} imagePath={imagePath} initialDate={date} initialItems={scannedItems} initialTitle={title} onClose={close} onSave={save} />;
}
