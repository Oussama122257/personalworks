import { createHash } from "crypto";

/**
 * Server-side Meta Pixel (Conversions API) helper.
 * Silently no-ops when META_PIXEL_ID / META_ACCESS_TOKEN are not configured,
 * and never throws — pixel failures must not break order flow.
 */
export async function trackServerEvent(
  eventName: "Purchase" | "InitiateCheckout" | "ViewContent",
  payload: {
    phone?: string;
    value?: number;
    currency?: string;
    contentIds?: string[];
    eventId?: string;
  }
) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.info(`[pixel] (disabled) ${eventName}`, payload.eventId ?? "");
    return;
  }

  const userData: Record<string, string[]> = {};
  if (payload.phone) {
    const normalized = payload.phone.replace(/\D/g, "");
    userData.ph = [createHash("sha256").update(normalized).digest("hex")];
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_id: payload.eventId,
              action_source: "website",
              user_data: userData,
              custom_data: {
                value: payload.value,
                currency: payload.currency ?? "DZD",
                content_ids: payload.contentIds,
                content_type: "product",
              },
            },
          ],
        }),
      }
    );
    if (!res.ok) {
      console.error("[pixel] Meta CAPI error", res.status, await res.text());
    }
  } catch (err) {
    console.error("[pixel] Meta CAPI request failed", err);
  }
}
