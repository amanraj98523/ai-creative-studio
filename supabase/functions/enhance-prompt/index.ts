import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type EnhancedPromptResult = {
  tone: string;
  intent: string;
  requirements: string[];
  enhancedPrompt: string;
  reasoning: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      prompt?: unknown;
    } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (prompt.length < 5 || prompt.length > 1000) {
      return jsonResponse(
        { error: "Prompt must be between 5 and 1000 characters." },
        400,
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "LOVABLE_API_KEY is not configured." }, 500);
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are an expert prompt engineer. Analyze the user text and improve it for image generation while preserving intent.",
            },
            {
              role: "user",
              content: `Analyze and improve this prompt:\n\n${prompt}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "enhance_prompt",
                description: "Return analysis and enhanced image prompt.",
                parameters: {
                  type: "object",
                  properties: {
                    tone: { type: "string" },
                    intent: { type: "string" },
                    requirements: {
                      type: "array",
                      items: { type: "string" },
                    },
                    enhancedPrompt: { type: "string" },
                    reasoning: { type: "string" },
                  },
                  required: [
                    "tone",
                    "intent",
                    "requirements",
                    "enhancedPrompt",
                    "reasoning",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "enhance_prompt" },
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429)
        return jsonResponse(
          { error: "Rate limit reached. Please retry shortly." },
          429,
        );
      if (response.status === 402)
        return jsonResponse(
          {
            error:
              "secure environment-based API  credits required. Add workspace usage credits and retry.",
          },
          402,
        );
      return jsonResponse(
        { error: `AI enhancement failed [${response.status}]: ${text}` },
        500,
      );
    }

    const payload = await response.json();
    const toolCall =
      payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolCall) {
      return jsonResponse(
        { error: "Invalid enhancement response from AI gateway." },
        500,
      );
    }

    const result = JSON.parse(toolCall) as EnhancedPromptResult;

    if (
      typeof result?.tone !== "string" ||
      typeof result?.intent !== "string" ||
      !Array.isArray(result?.requirements) ||
      typeof result?.enhancedPrompt !== "string" ||
      typeof result?.reasoning !== "string"
    ) {
      return jsonResponse({ error: "Malformed enhancement payload." }, 500);
    }

    return jsonResponse({
      tone: result.tone.slice(0, 120),
      intent: result.intent.slice(0, 240),
      requirements: result.requirements
        .map((item) => String(item).slice(0, 80))
        .slice(0, 8),
      enhancedPrompt: result.enhancedPrompt.slice(0, 1000),
      reasoning: result.reasoning.slice(0, 500),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("enhance-prompt error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
