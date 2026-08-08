"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flame, Loader2, Send, ShieldAlert, Ticket } from "lucide-react";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TicketRow {
  id: string;
  reference: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  escalatedAt: string | null;
  contactName?: string | null;
  buyer?: { fullName: string; email?: string | null; phone: string } | null;
  order?: { reference: string; totalAmount: number; status: string } | null;
  assignedTo?: { fullName: string } | null;
  _count: { messages: number };
}

interface TicketDetail extends TicketRow {
  order?:
    | (TicketRow["order"] & {
        address: string;
        wilaya?: { name: string } | null;
        items: { id: string; quantity: number; variant: { product: { name: string } } }[];
        shipments: {
          status: string;
          trackingNumber?: string | null;
          codAmount: number;
          attemptCount: number;
        }[];
      })
    | null;
  messages: {
    id: string;
    body: string;
    authorType: string;
    createdAt: string;
    author?: { fullName: string; role: string } | null;
  }[];
}

const PRIORITY_STYLE: Record<string, "secondary" | "warning" | "destructive"> = {
  LOW: "secondary",
  NORMAL: "secondary",
  HIGH: "warning",
  URGENT: "destructive",
};

const QUICK_REPLIES = [
  {
    label: "Retard de livraison",
    body: "Bonjour, nous vous confirmons que votre colis est bien en cours d'acheminement. Notre livreur vous contactera dans les 24 heures. Merci de votre patience.",
  },
  {
    label: "Demande d'adresse",
    body: "Bonjour, notre livreur n'a pas pu localiser votre adresse. Pourriez-vous nous préciser un point de repère ainsi qu'un numéro joignable ?",
  },
  {
    label: "Retour / remboursement",
    body: "Bonjour, votre demande de retour est enregistrée. Le colis sera récupéré par notre livreur sous 48 heures et le remboursement interviendra après contrôle.",
  },
  {
    label: "Résolution confirmée",
    body: "Bonjour, nous vous confirmons que votre demande a été résolue. N'hésitez pas à nous répondre si vous avez besoin d'autre chose.",
  },
];

export default function SupportDashboard() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: tickets } = useQuery<TicketRow[]>({
    queryKey: ["support-tickets", statusFilter],
    queryFn: async () => {
      const qs = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`/api/support/tickets${qs}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      return data.tickets;
    },
  });

  const { data: detail } = useQuery<TicketDetail>({
    queryKey: ["support-ticket", openId],
    enabled: Boolean(openId),
    queryFn: async () => {
      const res = await fetch(`/api/support/tickets/${openId}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      const data = await res.json();
      return data.ticket;
    },
  });

  async function sendReply() {
    if (!openId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: openId, body: reply }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'envoi");
        return;
      }
      toast.success("Réponse envoyée — le client a été notifié");
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", openId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    } finally {
      setSending(false);
    }
  }

  async function updateTicket(patch: Record<string, unknown>) {
    if (!openId) return;
    const res = await fetch(`/api/support/tickets/${openId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error("Échec de la mise à jour");
      return;
    }
    toast.success("Ticket mis à jour");
    queryClient.invalidateQueries({ queryKey: ["support-ticket", openId] });
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
  }

  async function runEscalation() {
    setEscalating(true);
    try {
      const res = await fetch("/api/support/escalate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success(
        data.escalated > 0
          ? `${data.escalated} ticket(s) escaladé(s) (seuil ${data.thresholdHours}h)`
          : `Aucun ticket au-delà du seuil de ${data.thresholdHours}h`
      );
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    } finally {
      setEscalating(false);
    }
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Support client</h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              <SelectItem value="OPEN">Ouverts</SelectItem>
              <SelectItem value="PENDING">En attente client</SelectItem>
              <SelectItem value="RESOLVED">Résolus</SelectItem>
              <SelectItem value="CLOSED">Clos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={escalating} onClick={runEscalation}>
            {escalating ? <Loader2 className="animate-spin" /> : <ShieldAlert />}
            Vérifier les escalades
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        L&apos;escalade automatique nécessite un ordonnanceur externe appelant{" "}
        <code>POST /api/support/escalate</code> avec l&apos;en-tête{" "}
        <code>x-cron-secret</code>. Le seuil est réglé par{" "}
        <code>SUPPORT_ESCALATION_HOURS</code> (24 h par défaut).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-4 w-4" /> File des tickets
          </CardTitle>
          <CardDescription>Triés par priorité, puis par ancienneté</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Messages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(t.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {t.reference}
                    {t.escalatedAt && (
                      <Flame className="ml-1 inline h-3 w-3 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell>
                    {t.buyer?.fullName ?? t.contactName ?? "Invité"}
                    <span className="block text-xs text-muted-foreground">
                      {t.order ? `Cmd ${t.order.reference}` : "Sans commande"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">{t.subject}</TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY_STYLE[t.priority] ?? "secondary"}>
                      {t.priority === "URGENT" && "🔥 "}
                      {t.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "OPEN" ? "warning" : "secondary"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{t._count.messages}</TableCell>
                </TableRow>
              ))}
              {(!tickets || tickets.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun ticket
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent>
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {detail.reference} — {detail.subject}
                </SheetTitle>
                <SheetDescription>
                  {detail.buyer?.fullName ?? detail.contactName ?? "Invité"} ·{" "}
                  {detail.buyer?.email ?? detail.buyer?.phone ?? "—"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <Select
                  value={detail.status}
                  onValueChange={(v) => updateTicket({ status: v })}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Ouvert</SelectItem>
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="RESOLVED">Résolu</SelectItem>
                    <SelectItem value="CLOSED">Clos</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={detail.priority}
                  onValueChange={(v) => updateTicket({ priority: v })}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Basse</SelectItem>
                    <SelectItem value="NORMAL">Normale</SelectItem>
                    <SelectItem value="HIGH">Haute</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                {!detail.assignedTo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateTicket({ assignToMe: true })}
                  >
                    M&apos;assigner
                  </Button>
                )}
              </div>

              {/* Order context */}
              {detail.order && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Commande {detail.order.reference}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Total : {formatDZD(detail.order.totalAmount)} · Statut :{" "}
                      {detail.order.status}
                    </p>
                    <p>
                      {detail.order.address}
                      {detail.order.wilaya ? `, ${detail.order.wilaya.name}` : ""}
                    </p>
                    <p>
                      {detail.order.items
                        ?.map((i) => `${i.variant.product.name} × ${i.quantity}`)
                        .join(", ")}
                    </p>
                    {detail.order.shipments?.map((s, i) => (
                      <p key={i}>
                        Colis {s.trackingNumber ?? "—"} : {s.status}
                        {s.attemptCount > 0 && ` (${s.attemptCount} tentative(s))`}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Thread */}
              <div className="flex-1 space-y-3">
                {detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg p-3 text-sm ${
                      m.authorType === "AGENT"
                        ? "ml-6 bg-primary/10"
                        : "mr-6 bg-muted"
                    }`}
                  >
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {m.author?.fullName ?? "Client"} ·{" "}
                      {new Date(m.createdAt).toLocaleString("fr-DZ")}
                    </p>
                    <p className="whitespace-pre-line">{m.body}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="space-y-2 border-t pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Réponses rapides</Label>
                  <Select onValueChange={(v) => setReply(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Insérer une réponse type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUICK_REPLIES.map((q) => (
                        <SelectItem key={q.label} value={q.body}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  rows={4}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Votre réponse au client…"
                />
                <Button
                  className="w-full"
                  disabled={!reply.trim() || sending}
                  onClick={sendReply}
                >
                  {sending ? <Loader2 className="animate-spin" /> : <Send />}
                  Envoyer la réponse
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
