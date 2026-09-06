import { router, useLocalSearchParams } from "expo-router";
import { useRoom } from "@/features/rooms/RoomProvider";
import { ReceiptForm } from "../expenses";
import type { ReceiptExpenseInput } from "@/features/shared-data/useExpenses";
import { useExpenses } from "@/features/shared-data/useExpenses";

export default function ReviewGroceryScreen() {
  const { room } = useRoom();
  const { photoName, photoUri } = useLocalSearchParams<{ photoName?: string; photoUri?: string }>();
  const { createReceiptExpense } = useExpenses(room?.room.id ?? "");
  if (!room) return null;
  const save = async (input: ReceiptExpenseInput) => { await createReceiptExpense(input); router.replace("/(room)/payments"); return true; };
  return <ReceiptForm visible members={room.members} photoName={photoName} photoUri={photoUri} onClose={() => router.back()} onSave={save} />;
}
