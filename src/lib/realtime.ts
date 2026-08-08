import Pusher from "pusher";

/**
 * Server-side realtime broadcaster (Pusher). No-ops when the Pusher env vars
 * are not configured so the app stays fully functional without realtime.
 *
 * Channels:
 *  - "orders"                → admin dashboard (event: "order:new")
 *  - "store-{storeId}"       → seller dashboard (event: "order:new")
 *  - "agent-{agentId}"       → agent app (event: "shipment:update")
 */
let pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (
    !process.env.PUSHER_APP_ID ||
    !process.env.NEXT_PUBLIC_PUSHER_KEY ||
    !process.env.PUSHER_SECRET
  ) {
    return null;
  }
  if (!pusher) {
    pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "eu",
      useTLS: true,
    });
  }
  return pusher;
}

export async function broadcast(
  channel: string,
  event: string,
  data: unknown
) {
  const client = getPusher();
  if (!client) return;
  try {
    await client.trigger(channel, event, data);
  } catch (err) {
    console.error("[realtime] broadcast failed", channel, event, err);
  }
}
