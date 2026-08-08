import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { TEMPLATE_DEFS } from "@/lib/templates";

/** ADMIN: templates merged over their defaults. */
export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const stored = await prisma.emailTemplate.findMany();
  const byKey = new Map(stored.map((t) => [t.key, t]));

  return NextResponse.json({
    templates: TEMPLATE_DEFS.map((def) => {
      const row = byKey.get(def.key);
      return {
        key: def.key,
        name: def.name,
        variables: def.variables,
        subject: row?.subject ?? def.subject,
        bodyHtml: row?.bodyHtml ?? def.bodyHtml,
        isActive: row?.isActive ?? true,
        customised: Boolean(row),
      };
    }),
  });
}

const schema = z.object({
  key: z.string().min(1),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(20000),
  isActive: z.boolean().default(true),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const def = TEMPLATE_DEFS.find((d) => d.key === parsed.data.key);
  if (!def) {
    return NextResponse.json({ error: "Unknown template key" }, { status: 404 });
  }

  const template = await prisma.emailTemplate.upsert({
    where: { key: def.key },
    update: {
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      isActive: parsed.data.isActive,
    },
    create: {
      key: def.key,
      name: def.name,
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      isActive: parsed.data.isActive,
    },
  });

  await recordAudit({
    actor: { id: session.user.id, role: "ADMIN" },
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: `template:${def.key}`,
    newState: { subject: template.subject, isActive: template.isActive },
    req,
  });

  return NextResponse.json({ success: true, template });
}

/** Restores a template to its shipped default. */
export async function DELETE(req: NextRequest) {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  await prisma.emailTemplate.deleteMany({ where: { key } });
  return NextResponse.json({ success: true });
}
