"use client";

import { useEffect } from "react";
import PusherClient from "pusher-js";

let client: PusherClient | null = null;

function getClient(): PusherClient | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  if (!key) return null;
  if (!client) {
    client = new PusherClient(key, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "eu",
    });
  }
  return client;
}

/**
 * Subscribe to a realtime channel event. No-ops when Pusher is not configured.
 * `channel` may be null to skip subscription (e.g. while ids are loading).
 */
export function useRealtime(
  channel: string | null,
  event: string,
  onMessage: (data: unknown) => void
) {
  useEffect(() => {
    if (!channel) return;
    const pusher = getClient();
    if (!pusher) return;
    const ch = pusher.subscribe(channel);
    ch.bind(event, onMessage);
    return () => {
      ch.unbind(event, onMessage);
      pusher.unsubscribe(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, event]);
}
