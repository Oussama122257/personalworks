import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";

/** LOGISTICS/ADMIN: courier list. Credentials are returned masked only. */
export async function GET() {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const couriers = await prisma.courier.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    couriers: couriers.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      logoUrl: c.logoUrl,
      apiEndpoint: c.apiEndpoint,
      apiKeyMasked: maskSecret(c.apiKey),
      hasCredentials: Boolean(c.apiKey),
      isActive: c.isActive,
    })),
  });
}

const createSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "Le code doit être en majuscules (A-Z, 0-9, _)"),
  name: z.string().min(2).max(80),
  logoUrl: z.string().max(500).nullable().optional(),
  apiEndpoint: z.string().max(500).nullable().optional(),
  apiKey: z.string().max(200).nullable().optional(),
  apiSecret: z.string().max(200).nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const exists = await prisma.courier.findUnique({ where: { code: parsed.data.code } });
  if (exists) {
    return NextResponse.json(
      { error: `Un transporteur avec le code « ${parsed.data.code} » existe déjà` },
      { status: 409 }
    );
  }

  const { apiKey, apiSecret, ...rest } = parsed.data;
  const courier = await prisma.courier.create({
    data: {
      ...rest,
      apiKey: apiKey ? encryptSecret(apiKey) : null,
      apiSecret: apiSecret ? encryptSecret(apiSecret) : null,
    },
  });

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "CREATE",
    entity: "SETTINGS",
    entityId: `courier:${courier.code}`,
    newState: { name: courier.name, isActive: courier.isActive },
    req,
  });

  return NextResponse.json({ success: true, courierId: courier.id }, { status: 201 });
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id, apiKey, apiSecret, ...rest } = parsed.data;
  const before = await prisma.courier.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Courier not found" }, { status: 404 });
  }

  const courier = await prisma.courier.update({
    where: { id },
    data: {
      ...rest,
      ...(apiKey !== undefined ? { apiKey: apiKey ? encryptSecret(apiKey) : null } : {}),
      ...(apiSecret !== undefined
        ? { apiSecret: apiSecret ? encryptSecret(apiSecret) : null }
        : {}),
    },
  });

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: `courier:${courier.code}`,
    oldState: { isActive: before.isActive, name: before.name },
    newState: { isActive: courier.isActive, name: courier.name },
    req,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.courier.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

/** Health check for one configured courier, using its stored credentials. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const courier = await prisma.courier.findUnique({ where: { id } });
  if (!courier) {
    return NextResponse.json({ error: "Courier not found" }, { status: 404 });
  }
  if (!courier.apiEndpoint) {
    return NextResponse.json({
      courier: courier.code,
      configured: false,
      online: false,
      latencyMs: null,
      error: "Aucun endpoint API configuré pour ce transporteur",
    });
  }

  // testConnection reads endpoints from env by courier code; this courier
  // carries its own, so probe it directly.
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(courier.apiEndpoint, {
      headers: {
        Authorization: `Bearer ${decryptSecret(courier.apiKey) ?? ""}`,
        "X-API-TOKEN": decryptSecret(courier.apiKey) ?? "",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return NextResponse.json({
      courier: courier.code,
      configured: true,
      online: res.ok,
      latencyMs: Date.now() - started,
      error: res.ok ? null : `Réponse ${res.status} du transporteur`,
    });
  } catch (err) {
    return NextResponse.json({
      courier: courier.code,
      configured: true,
      online: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Échec de connexion",
    });
  }
}
