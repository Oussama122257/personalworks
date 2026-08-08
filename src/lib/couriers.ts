/**
 * Courier integrations.
 *
 * Endpoints are configurable so a deployment can point at sandbox or
 * production hosts. When an endpoint is not configured, `testConnection`
 * reports `configured: false` instead of pretending the credentials work —
 * never claim a connection succeeded without actually reaching the courier.
 */

export const COURIERS = ["YALIDINE", "ZR_EXPRESS", "POSTE"] as const;
export type CourierType = (typeof COURIERS)[number];

function endpointFor(courier: string): string | null {
  const map: Record<string, string | undefined> = {
    YALIDINE: process.env.YALIDINE_API_URL,
    ZR_EXPRESS: process.env.ZR_EXPRESS_API_URL,
    POSTE: process.env.POSTE_API_URL,
  };
  return map[courier] ?? null;
}

export interface CourierProbe {
  courier: string;
  configured: boolean;
  online: boolean;
  latencyMs: number | null;
  error: string | null;
}

/** Pings a courier's endpoint with the given credentials. */
export async function testConnection(
  courier: string,
  credentials: { apiKey?: string | null; apiSecret?: string | null; accountNumber?: string | null }
): Promise<CourierProbe> {
  const url = endpointFor(courier);
  if (!url) {
    return {
      courier,
      configured: false,
      online: false,
      latencyMs: null,
      error: `Aucun endpoint configuré pour ${courier} (${courier}_API_URL)`,
    };
  }
  if (!credentials.apiKey) {
    return {
      courier,
      configured: true,
      online: false,
      latencyMs: null,
      error: "Clé API manquante",
    };
  }

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-ID": credentials.accountNumber ?? "",
        "X-API-TOKEN": credentials.apiKey,
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      return {
        courier,
        configured: true,
        online: false,
        latencyMs,
        error: `Réponse ${res.status} du transporteur`,
      };
    }
    return { courier, configured: true, online: true, latencyMs, error: null };
  } catch (err) {
    return {
      courier,
      configured: true,
      online: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Échec de connexion",
    };
  }
}

/** Health probe without seller credentials — uses platform-level keys. */
export async function probeCourier(courier: string): Promise<CourierProbe> {
  const platformKey: Record<string, string | undefined> = {
    YALIDINE: process.env.YALIDINE_API_KEY,
    ZR_EXPRESS: process.env.ZR_EXPRESS_API_KEY,
    POSTE: process.env.POSTE_API_KEY,
  };
  return testConnection(courier, { apiKey: platformKey[courier] ?? null });
}
