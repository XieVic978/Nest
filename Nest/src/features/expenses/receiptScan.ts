import { File } from "expo-file-system";

import { getSupabaseClient } from "@/lib/supabase";

export type ScannedReceipt = {
  merchant: string;
  purchasedAt: string | null;
  items: { name: string; amount: number }[];
};

function decodeBase64(base64: string): ArrayBuffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let index = 0; index < alphabet.length; index += 1) lookup[alphabet.charCodeAt(index)] = index;
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array(Math.max(0, (clean.length * 3) / 4 - padding));
  let cursor = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const first = lookup[clean.charCodeAt(index)];
    const second = lookup[clean.charCodeAt(index + 1)];
    const third = lookup[clean.charCodeAt(index + 2)];
    const fourth = lookup[clean.charCodeAt(index + 3)];
    if (cursor < bytes.length) bytes[cursor++] = (first << 2) | (second >> 4);
    if (cursor < bytes.length) bytes[cursor++] = ((second & 15) << 4) | (third >> 2);
    if (cursor < bytes.length) bytes[cursor++] = ((third & 3) << 6) | fourth;
  }
  return bytes.buffer;
}

export async function uploadAndScanReceipt(roomId: string, localUri: string): Promise<{ imagePath: string; receipt: ScannedReceipt }> {
  const client = getSupabaseClient();
  const path = `${roomId}/${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}.jpg`;
  const bytes = decodeBase64(await new File(localUri).base64());
  const { error: uploadError } = await client.storage.from("receipts").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: scanError } = await client.functions.invoke("scan-receipt", { body: { imagePath: path } });
  if (scanError) throw new Error(scanError.message);
  const record = (data ?? {}) as Record<string, unknown>;
  if (record.error) throw new Error(String(record.error));
  const rawItems = Array.isArray(record.items) ? record.items : [];
  return {
    imagePath: path,
    receipt: {
      merchant: typeof record.merchant === "string" ? record.merchant : "",
      purchasedAt: typeof record.purchasedAt === "string" ? record.purchasedAt : null,
      items: rawItems.map((value) => {
        const item = value as Record<string, unknown>;
        return { name: typeof item.name === "string" ? item.name : "", amount: Math.max(0, Number(item.amount) || 0) };
      }).filter((item) => item.name),
    },
  };
}
