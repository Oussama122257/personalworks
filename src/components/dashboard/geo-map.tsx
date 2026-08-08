"use client";

import { formatDZD } from "@/lib/utils";

export interface WilayaDensity {
  code: number;
  name: string;
  orders: number;
  revenue: number;
}

/**
 * Order density across the 58 wilayas, drawn as a colour-coded grid rather than
 * a geographic outline: no GeoJSON boundary file ships with the repo, and a
 * grid keeps every wilaya legible and clickable at dashboard size.
 */
export function GeoMap({
  density,
  maxOrders,
}: {
  density: WilayaDensity[];
  maxOrders: number;
}) {
  function shade(orders: number) {
    if (orders === 0) return "bg-muted text-muted-foreground";
    const ratio = maxOrders > 0 ? orders / maxOrders : 0;
    if (ratio > 0.75) return "bg-orange-600 text-white";
    if (ratio > 0.5) return "bg-orange-500 text-white";
    if (ratio > 0.25) return "bg-orange-400 text-white";
    return "bg-orange-200 text-orange-950";
  }

  return (
    <div>
      <div className="grid grid-cols-6 gap-1 sm:grid-cols-8 lg:grid-cols-10">
        {density.map((w) => (
          <div
            key={w.code}
            title={`${w.name} — ${w.orders} commande(s), ${formatDZD(w.revenue)}`}
            className={`flex aspect-square flex-col items-center justify-center rounded-md text-[10px] leading-tight transition-transform hover:scale-110 ${shade(w.orders)}`}
          >
            <span className="font-bold">{w.code}</span>
            <span className="w-full truncate px-0.5 text-center opacity-80">
              {w.name}
            </span>
            {w.orders > 0 && <span className="font-semibold">{w.orders}</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Aucune</span>
        <span className="h-3 w-6 rounded bg-muted" />
        <span className="h-3 w-6 rounded bg-orange-200" />
        <span className="h-3 w-6 rounded bg-orange-400" />
        <span className="h-3 w-6 rounded bg-orange-500" />
        <span className="h-3 w-6 rounded bg-orange-600" />
        <span>{maxOrders} commandes</span>
      </div>
    </div>
  );
}
