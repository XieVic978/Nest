// Client-side glue for uploading a receipt image and running OCR through the
// authenticated `scan-receipt` Edge Function.
//
// The OCR provider key lives ONLY in the Edge Function's secrets — never in the
// app. This module just uploads the image to the private `receipts` bucket and
// asks the Edge Function to analyze it.

import { File } from "expo-file-system";

import { getSupabaseClient } from "@/lib/supabase";

import type { ScanResult } from "./types";

// Upload a local image uri to `receipts/<roomId>/<uuid>.jpg`. Returns the
// stored object path (not a URL), which is what we persist on the expense.
export async function uploadReceiptImage(
  roomId: string,
  localUri: string
): Promise<string> {
  const client = getSupabaseClient();

  // SDK 57 filesystem API: read the captured image as base64, then decode to a
  // real ArrayBuffer. In React Native, neither a bare Uint8Array nor
  // `new Blob([bytes])` uploads correctly (the stored object ends up not being
  // valid image bytes). Supabase Storage reliably accepts an ArrayBuffer.
  const base64 = await new File(localUri).base64();
  const arrayBuffer = decodeBase64ToArrayBuffer(base64);

  const path = `${roomId}/${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}.jpg`;

  const { error } = await client.storage.from("receipts").upload(path, arrayBuffer, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// Decode a base64 string into an ArrayBuffer of the real bytes.
function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.max(0, (clean.length * 3) / 4 - padding);
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    if (p < byteLength) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < byteLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < byteLength) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes.buffer;
}

// Ask the Edge Function to OCR the uploaded image. Throws on failure so callers
// can fall back to manual entry.
export async function scanReceipt(imagePath: string): Promise<ScanResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke("scan-receipt", {
    body: { imagePath },
  });
  if (error) {
    throw new Error(error.message ?? "scan-receipt call failed");
  }
  // The function returns 200 even for provider failures so the reason survives
  // in the body. Detect and surface it here.
  const record = (data ?? {}) as Record<string, unknown>;
  if (record.error) {
    let detail = String(record.error);
    if (record.providerStatus) detail += ` (${record.providerStatus})`;
    if (record.providerDetail) {
      detail += `: ${String(record.providerDetail).slice(0, 200)}`;
    }
    throw new Error(detail);
  }
  return normalizeScanResult(data);
}

// The Edge Function returns cents already, but be defensive about shape.
function normalizeScanResult(data: unknown): ScanResult {
  const record = (data ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  return {
    merchant: typeof record.merchant === "string" ? record.merchant : "",
    purchasedAt:
      typeof record.purchasedAt === "string" ? record.purchasedAt : null,
    subtotalCents: toCents(record.subtotalCents),
    taxCents: toCents(record.taxCents),
    tipCents: toCents(record.tipCents),
    totalCents: toCents(record.totalCents),
    items: rawItems.map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return {
        name: typeof item.name === "string" ? item.name : "",
        quantity: Math.max(1, Math.round(toNumber(item.quantity, 1))),
        lineTotalCents: toCents(item.lineTotalCents),
      };
    }),
  };
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toCents(value: unknown): number {
  const n = Math.round(toNumber(value, 0));
  return n >= 0 ? n : 0;
}
