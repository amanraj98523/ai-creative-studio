const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type GatewayPayload = {
  model: string;
  messages: Array<{ role: "system" | "user"; content: MessageContent }>;
  tools?: unknown[];
  tool_choice?: unknown;
  modalities?: string[];
};

export async function callAiGateway(payload: GatewayPayload) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured.");
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 429) {
      throw new Error("Rate limit reached. Please retry shortly.");
    }
    if (response.status === 402) {
      throw new Error(
        "secure environment-based API  credits required. Add workspace usage credits and retry.",
      );
    }
    throw new Error(`AI gateway failed [${response.status}]: ${text}`);
  }

  return response.json();
}

export function extractFirstImage(payload: any): string {
  const image = payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new Error("No generated image returned from AI gateway.");
  }
  return image;
}
