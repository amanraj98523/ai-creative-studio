import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { callAiGateway, extractFirstImage } from "../_shared/ai.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null) as { prompt?: unknown; count?: unknown } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const countValue = typeof body?.count === "number" ? body.count : 2;
    const count = Number.isInteger(countValue) ? Math.min(4, Math.max(1, countValue)) : 2;

    if (prompt.length < 5 || prompt.length > 1000) {
      return jsonResponse({ error: "Prompt must be between 5 and 1000 characters." }, 400);
    }

    const images: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const payload = await callAiGateway({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nCreate version ${index + 1} with subtle composition differences while preserving the main concept.`,
          },
        ],
        modalities: ["image", "text"],
      });

      images.push(extractFirstImage(payload));
    }

    return jsonResponse({ images, promptUsed: prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-from-prompt error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
