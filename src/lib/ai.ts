/**
 * Product description generation.
 *
 * Uses OpenAI when OPENAI_API_KEY is configured. Without a key it falls back to
 * a deterministic template so the seller wizard keeps working offline — the
 * caller is told which path produced the text via the `generated` flag.
 */

export interface DescriptionResult {
  fr: string;
  ar: string;
  generated: boolean;
}

function fallback(name: string, category: string): DescriptionResult {
  return {
    fr: `${name} — article de la catégorie ${category}, disponible sur Zeem Marketplace. Qualité vérifiée par notre équipe, livraison dans les 58 wilayas avec paiement à la livraison. Complétez cette description avec les matières, dimensions et conseils d'entretien.`,
    ar: `${name} — منتج من فئة ${category}، متوفر على منصة زيم. جودة مضمونة، التوصيل إلى 58 ولاية مع الدفع عند الاستلام.`,
    generated: false,
  };
}

export async function generateDescription(
  name: string,
  category: string
): Promise<DescriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-...")) {
    return fallback(name, category);
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write e-commerce product descriptions for an Algerian marketplace. Reply with JSON: {\"fr\": \"...\", \"ar\": \"...\"}. French description ~60 words, Arabic ~40 words. Concrete and factual; never invent materials, sizes or certifications.",
          },
          {
            role: "user",
            content: `Product name: ${name}\nCategory: ${category}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[ai] OpenAI error", res.status, await res.text());
      return fallback(name, category);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback(name, category);

    const parsed = JSON.parse(content);
    if (typeof parsed.fr !== "string" || typeof parsed.ar !== "string") {
      return fallback(name, category);
    }
    return { fr: parsed.fr, ar: parsed.ar, generated: true };
  } catch (err) {
    console.error("[ai] description generation failed", err);
    return fallback(name, category);
  }
}
