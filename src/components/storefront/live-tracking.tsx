"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LocationFeed {
  reference: string;
  status: string;
  shipments: {
    shipmentId: string;
    trackingNumber?: string | null;
    status: string;
    attemptCount: number;
    agentName: string | null;
    agentPhoneMasked: string | null;
    location: { lat: number; lng: number; accuracy?: number | null; at: string } | null;
  }[];
}

/**
 * Live agent position for a tracked order.
 *
 * The map is an OpenStreetMap embed rather than a Leaflet bundle: it needs no
 * extra client library and no API key, and it renders the same tiles. Polls
 * every 20s while a delivery is in progress.
 */
export function LiveTracking({ reference }: { reference: string }) {
  const { data } = useQuery<LocationFeed>({
    queryKey: ["tracking", reference],
    queryFn: async () => {
      const res = await fetch(`/api/track/${reference}/location`);
      if (!res.ok) throw new Error("Failed to load tracking");
      return res.json();
    },
    refetchInterval: (query) => {
      const d = query.state.data as LocationFeed | undefined;
      const live = d?.shipments.some((s) =>
        ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status)
      );
      return live ? 20_000 : false;
    },
  });

  const withLocation = data?.shipments.filter((s) => s.location) ?? [];
  if (withLocation.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      {withLocation.map((s) => {
        const { lat, lng } = s.location!;
        const delta = 0.01;
        const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
        return (
          <Card key={s.shipmentId}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" /> Position du livreur
                </span>
                <Badge variant="secondary">{s.status}</Badge>
              </CardTitle>
              <CardDescription>
                Dernière mise à jour :{" "}
                {new Date(s.location!.at).toLocaleString("fr-DZ")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <iframe
                title={`Carte ${s.shipmentId}`}
                className="h-64 w-full rounded-lg border"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
              />
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
                {s.agentName && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {s.agentName} — {s.agentPhoneMasked}
                  </span>
                )}
                {s.attemptCount > 0 && (
                  <span>
                    Tentative{s.attemptCount > 1 ? "s" : ""} : {s.attemptCount}/3
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
