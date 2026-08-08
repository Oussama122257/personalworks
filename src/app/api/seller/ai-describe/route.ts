import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { generateDescription } from "@/lib/ai";

const schema = z.object({
  name: z.string().min(2).max(200),
  category: z.string().min(2).max(100),
});

/**
 * SELLER: generate a French + Arabic product description.
 * Falls back to a template when OPENAI_API_KEY is not configured; the response
 * says which path produced the text via `generated`.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireRole(["SELLER", "ADMIN", "ERP_MANAGER"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await generateDescription(parsed.data.name, parsed.data.category);
  return NextResponse.json(result);
}
