import { router, useLocalSearchParams } from "expo-router";
import { useRoom } from "@/features/rooms/RoomProvider";
import { ReceiptForm } from "../expenses";
import type { ReceiptExpenseInput } from "@/features/shared-data/useExpenses";
import { useExpenses } from "@/features/shared-data/useExpenses";

export default function ReviewGroceryScreen() {
  const { room } = useRoom();
  const { date, imagePath, items, photoName, photoUri, title } = useLocalSearchParams<{ date?: string; imagePath?: string; items?: string; photoName?: string; photoUri?: string; title?: string }>();
  const { createReceiptExpense } = useExpenses(room?.room.id ?? "");
  if (!room) return null;
  const save = async (input: ReceiptExpenseInput) => { await createReceiptExpense(input); router.replace("/(room)/payments"); return true; };
  let scannedItems: { name: string; amount: number }[] = [];
  try { scannedItems = items ? JSON.parse(items) : []; } catch { scannedItems = []; }
  return <ReceiptForm visible members={room.members} photoName={photoName} photoUri={photoUri} imagePath={imagePath} initialDate={date} initialItems={scannedItems} initialTitle={title} onClose={() => router.back()} onSave={save} />;
}
