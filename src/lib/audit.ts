import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * Audit logging for state-changing requests.
 *
 * Next.js middleware runs on the edge and cannot reach Prisma, and it sees the
 * request before the handler computes any state — so a true "global
 * interceptor" cannot capture oldState/newState. Instead `withAudit` wraps a
 * route handler: it snapshots the entity before and after the mutation and
 * writes one AuditLog row. Handlers that already know their own diff can call
 * `recordAudit` directly.
 */

export interface AuditActor {
  id: string;
  role: string;
}

export async function recordAudit(params: {
  actor: AuditActor;
  action: string; // CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN
  entity: string; // STORE | PRODUCT | ORDER | USER | SETTINGS | FINANCE
  entityId: string;
  oldState?: unknown;
  newState?: unknown;
  reason?: string | null;
  req?: NextRequest;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.actor.id,
        userRole: params.actor.role as Role,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldState: (params.oldState ?? undefined) as never,
        newState: (params.newState ?? undefined) as never,
        reason: params.reason ?? null,
        ipAddress: params.req ? clientIp(params.req) : null,
        userAgent: params.req?.headers.get("user-agent") ?? null,
      },
    });
  } catch (err) {
    // Audit must never break the operation it is recording.
    console.error("[audit] failed to write log", err);
  }
}

export function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Wraps a mutation so the before/after snapshots are captured automatically.
 * `load` reads the current entity state; it runs once before and once after.
 */
export async function withAudit<T>(
  params: {
    actor: AuditActor;
    action: string;
    entity: string;
    entityId: string;
    reason?: string | null;
    req?: NextRequest;
    load: () => Promise<unknown>;
  },
  mutate: () => Promise<T>
): Promise<T> {
  const before = await params.load().catch(() => null);
  const result = await mutate();
  const after = await params.load().catch(() => null);
  await recordAudit({ ...params, oldState: before, newState: after });
  return result;
}
