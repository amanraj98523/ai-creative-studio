import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { callAiGateway, extractFirstImage } from "../_shared/ai.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type AnalyzeResult = {
  caption: string;
  tags: string[];
  style: string;
  theme: string;
  generationPrompt: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null) as {
      imageDataUrl?: unknown;
      imageUrl?: unknown;
      mode?: unknown;
      count?: unknown;
    } | null;

    const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    const hasDataUrl = imageDataUrl.startsWith("data:image/");
    const hasImageUrl = /^https?:\/\/.+/i.test(imageUrl);

    if (!hasDataUrl && !hasImageUrl) {
      return jsonResponse({ error: "Provide a valid image data URL or image URL." }, 400);
    }

    const mode = body?.mode === "similar" ? "similar" : "variations";
    const countValue = typeof body?.count === "number" ? body.count : 2;
    const count = Number.isInteger(countValue) ? Math.min(4, Math.max(1, countValue)) : 2;

    const sourceImage = hasDataUrl ? imageDataUrl : imageUrl;

    const analysisPayload = await callAiGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: "Analyze image content and return structured caption, tags, style, theme, and an image-generation prompt.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this image and produce a generation prompt for ${mode}.` },
            { type: "image_url", image_url: { url: sourceImage } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_uploaded_image",
            description: "Return concise image analysis and generation prompt.",
            parameters: {
              type: "object",
              properties: {
                caption: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                style: { type: "string" },
                theme: { type: "string" },
                generationPrompt: { type: "string" },
              },
              required: ["caption", "tags", "style", "theme", "generationPrompt"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "analyze_uploaded_image" } },
    });

    const toolCall = analysisPayload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolCall) {
      return jsonResponse({ error: "Invalid image analysis response." }, 500);
    }

    const analysis = JSON.parse(toolCall) as AnalyzeResult;
    if (
      typeof analysis?.caption !== "string" ||
      !Array.isArray(analysis?.tags) ||
      typeof analysis?.style !== "string" ||
      typeof analysis?.theme !== "string" ||
      typeof analysis?.generationPrompt !== "string"
    ) {
      return jsonResponse({ error: "Malformed analysis payload." }, 500);
    }

    const images: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const generationPayload = await callAiGateway({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `${analysis.generationPrompt}\n` +
                  `Output mode: ${mode}. Generate version ${index + 1}. Keep main subject recognizable and produce a coherent high-quality image.`,
              },
              { type: "image_url", image_url: { url: sourceImage } },
            ],
          },
        ],
        modalities: ["image", "text"],
      });

      images.push(extractFirstImage(generationPayload));
    }

    return jsonResponse({
      caption: analysis.caption.slice(0, 280),
      tags: analysis.tags.map((tag) => String(tag).slice(0, 40)).slice(0, 12),
      style: analysis.style.slice(0, 120),
      theme: analysis.theme.slice(0, 120),
      promptUsed: analysis.generationPrompt.slice(0, 1000),
      images,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("analyze-image error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
