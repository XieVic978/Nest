// Supabase Edge Function: scan-receipt
//
// Authenticated OCR/vision for a receipt image stored in the private `receipts`
// bucket. The caller passes { imagePath }. This function:
//   1. Verifies the caller is authenticated (JWT forwarded by supabase-js).
//   2. Downloads the image from storage using the caller's credentials, so RLS
//      still applies (a user can only scan receipts in their own Nest).
//   3. Sends it to a vision model and returns a normalized result in integer
//      cents.
//
// The provider API key comes ONLY from the Edge Function secret OPENAI_API_KEY.
// It is never in the app bundle or in client code.
//
// Deploy:   supabase functions deploy scan-receipt
// Secret:   supabase secrets set OPENAI_API_KEY=sk-...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Turn a dollar amount (number or string) into integer cents.
function toCents(value: unknown): number {
  const n = typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing_authorization" }, 401);

    if (!OPENAI_API_KEY) {
      return json({ error: "ocr_not_configured" }, 500);
    }

    // Client scoped to the caller's JWT so storage RLS is enforced.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "unauthenticated" }, 401);
    }

    const { imagePath } = await req.json().catch(() => ({}));
    if (typeof imagePath !== "string" || !imagePath) {
      return json({ error: "missing_image_path" }, 400);
    }

    // Download the image (RLS: caller must be a member of the room in path[0]).
    const { data: file, error: downloadError } = await supabase.storage
      .from("receipts")
      .download(imagePath);
    if (downloadError || !file) {
      return json({ error: "image_not_found" }, 404);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type && file.type.startsWith("image/")
      ? file.type
      : "image/jpeg";
    const base64 = encodeBase64(bytes);

    // Ask the vision model to extract structured receipt data as strict JSON.
    const prompt = [
      "You are a receipt parser. Extract the receipt in this image.",
      "Return ONLY strict JSON with this exact shape and no commentary:",
      '{"merchant": string, "purchasedAt": string|null (ISO date), "items": [{"name": string, "quantity": number, "lineTotal": number}], "subtotal": number, "tax": number, "tip": number, "total": number}',
      "All amounts are in dollars as numbers (e.g. 12.99). If a field is unknown, use 0 or null. quantity defaults to 1.",
    ].join("\n");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${contentType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      // Surface the provider's reason. Return 200 so supabase-js exposes this
      // body in `data` (a non-2xx status hides the body behind a generic
      // error), letting the app show the real reason.
      const detail = await aiRes.text().catch(() => "");
      console.error("OpenAI error", aiRes.status, detail);
      return json({
        error: "ocr_provider_error",
        providerStatus: aiRes.status,
        providerDetail: detail.slice(0, 500),
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ error: "ocr_parse_error" }, 502);
    }

    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const result = {
      merchant: typeof parsed.merchant === "string" ? parsed.merchant : "",
      purchasedAt:
        typeof parsed.purchasedAt === "string" ? parsed.purchasedAt : null,
      subtotalCents: toCents(parsed.subtotal),
      taxCents: toCents(parsed.tax),
      tipCents: toCents(parsed.tip),
      totalCents: toCents(parsed.total),
      items: rawItems.map((raw: Record<string, unknown>) => ({
        name: typeof raw?.name === "string" ? raw.name : "",
        quantity: Math.max(1, Math.round(Number(raw?.quantity) || 1)),
        lineTotalCents: toCents(raw?.lineTotal),
      })),
    };

    return json(result);
  } catch (_err) {
    return json({ error: "unexpected_error" }, 500);
  }
});


