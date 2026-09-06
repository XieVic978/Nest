import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const openAiKey = Deno.env.get("OPENAI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const dollars = (value: unknown) => Math.max(0, Math.round((Number(typeof value === "string" ? value.replace(/[^0-9.]/g, "") : value) || 0) * 100) / 100);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!openAiKey) return json({ error: "Receipt scanning is not configured yet." }, 503);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "You need to sign in before scanning a receipt." }, 401);

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) return json({ error: "You need to sign in before scanning a receipt." }, 401);
    const { imagePath } = await request.json();
    if (typeof imagePath !== "string" || !imagePath) return json({ error: "A receipt image is required." }, 400);

    const { data: image, error: imageError } = await client.storage.from("receipts").download(imagePath);
    if (imageError || !image) return json({ error: "The receipt image could not be found." }, 404);
    const base64 = encodeBase64(new Uint8Array(await image.arrayBuffer()));
    const contentType = image.type?.startsWith("image/") ? image.type : "image/jpeg";
    const prompt = "Read this grocery receipt. Return only JSON: {\\\"merchant\\\": string, \\\"purchasedAt\\\": string|null, \\\"items\\\": [{\\\"name\\\": string, \\\"amount\\\": number}]}. Amounts must be each line item's final dollar total. Use ISO YYYY-MM-DD for purchasedAt if visible, otherwise null. Exclude subtotal, tax, tip, coupons, and payment lines. If unreadable, return an empty items array.";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${contentType};base64,${base64}` } }] }] }),
    });
    if (!response.ok) {
      console.error("OpenAI receipt scan failed", response.status, await response.text());
      return json({ error: "Receipt scan failed. You can still enter items manually." }, 502);
    }
    const completion = await response.json();
    const parsed = JSON.parse(completion?.choices?.[0]?.message?.content ?? "{}");
    const items = Array.isArray(parsed.items) ? parsed.items.map((item: Record<string, unknown>) => ({ name: typeof item?.name === "string" ? item.name.trim() : "", amount: dollars(item?.amount) })).filter((item: { name: string }) => item.name) : [];
    return json({ merchant: typeof parsed.merchant === "string" ? parsed.merchant : "", purchasedAt: typeof parsed.purchasedAt === "string" ? parsed.purchasedAt : null, items });
  } catch (error) {
    console.error("Unexpected receipt scan error", error);
    return json({ error: "Receipt scan failed. You can still enter items manually." }, 500);
  }
});
