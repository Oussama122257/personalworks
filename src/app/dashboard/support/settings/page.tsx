"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import {
  SettingsSection,
  Field,
  ToggleRow,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SupportSettings {
  autoAssignTickets: boolean;
  routingAlgorithm: string;
  slaHours: number;
  escalateAfterHours: number;
  highPriorityKeywords: string;
  autoTagHighPriority: boolean;
  showOrderHistory: boolean;
  showPreviousTickets: boolean;
  allowTestOrders: boolean;
}

interface CannedDTO {
  id: string;
  title: string;
  category: string;
  body: string;
}

const EMPTY_CANNED = { id: "", title: "", category: "Général", body: "" };

function CannedDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: typeof EMPTY_CANNED;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/support/canned-responses", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          form.id
            ? { id: form.id, title: form.title, category: form.category, body: form.body }
            : { title: form.title, category: form.category, body: form.body }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success(form.id ? "Réponse mise à jour" : "Réponse ajoutée");
      onClose();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {form.id ? "Modifier la réponse" : "Nouvelle réponse rapide"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titre">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Retard de livraison"
              />
            </Field>
            <Field label="Catégorie" hint="Regroupe les réponses dans la liste.">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Problèmes COD"
              />
            </Field>
          </div>
          <Field label="Message" hint="Le HTML simple est accepté.">
            <Textarea
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </Field>
          <Button
            className="w-full"
            disabled={busy || form.title.length < 2 || form.body.length < 2}
            onClick={save}
          >
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SupportSettingsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<typeof EMPTY_CANNED | null>(null);

  const { data } = useQuery<{
    support: SupportSettings;
    preferences: { notifications: Record<string, boolean> };
  }>({
    queryKey: ["support-settings"],
    queryFn: async () => {
      const res = await fetch("/api/support/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: canned } = useQuery<CannedDTO[]>({
    queryKey: ["canned-responses"],
    queryFn: async () => {
      const res = await fetch("/api/support/canned-responses");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.responses;
    },
  });

  const rules = useSettingsForm(data?.support, "/api/support/settings", (v) => ({
    support: v,
  }));
  const notifs = useSettingsForm(
    data?.preferences.notifications,
    "/api/support/settings",
    (v) => ({ notifications: v })
  );

  if (!data || !rules.values) {
    return (
      <div className="container flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const s = rules.values;
  const n = notifs.values ?? {};
  const grouped = (canned ?? []).reduce<Record<string, CannedDTO[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Paramètres du support</h1>

      <Tabs defaultValue="rules">
        <TabsList className="flex-wrap">
          <TabsTrigger value="rules">Tickets</TabsTrigger>
          <TabsTrigger value="canned">Réponses rapides</TabsTrigger>
          <TabsTrigger value="escalation">Escalade</TabsTrigger>
          <TabsTrigger value="context">Contexte &amp; notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <SettingsSection
            title="Règles de gestion des tickets"
            footer={<SaveButton onSave={rules.save} dirty={rules.dirty} />}
          >
            <ToggleRow
              label="Attribution automatique"
              description="Assigne chaque nouveau ticket à un agent disponible."
              checked={s.autoAssignTickets}
              onChange={(v) => rules.set("autoAssignTickets", v)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Algorithme d'attribution">
                <Select
                  value={s.routingAlgorithm}
                  onValueChange={(v) => rules.set("routingAlgorithm", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROUND_ROBIN">Tour de rôle</SelectItem>
                    <SelectItem value="LEAST_BUSY">Le moins chargé</SelectItem>
                    <SelectItem value="PRIORITY">Par priorité</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Délai de réponse SLA (heures)">
                <Input
                  type="number"
                  value={s.slaHours}
                  onChange={(e) => rules.set("slaHours", Number(e.target.value))}
                />
              </Field>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="canned">
          <SettingsSection
            title="Bibliothèque de réponses rapides"
            description="Insérables en un clic depuis le tiroir de ticket."
            footer={
              <Button variant="outline" onClick={() => setEditing({ ...EMPTY_CANNED })}>
                <Plus /> Ajouter une réponse
              </Button>
            }
          >
            <div className="space-y-5">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 text-sm font-medium">
                    <Badge variant="secondary">{category}</Badge>
                  </p>
                  <div className="space-y-2">
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{c.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {c.body}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setEditing({
                                id: c.id,
                                title: c.title,
                                category: c.category,
                                body: c.body,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (!confirm(`Supprimer « ${c.title} » ?`)) return;
                              await fetch(`/api/support/canned-responses?id=${c.id}`, {
                                method: "DELETE",
                              });
                              toast.success("Réponse supprimée");
                              queryClient.invalidateQueries({
                                queryKey: ["canned-responses"],
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(!canned || canned.length === 0) && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune réponse enregistrée.
                </p>
              )}
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="escalation">
          <SettingsSection
            title="Règles d'escalade"
            description="La vérification tourne via l'ordonnanceur externe ou le bouton du tableau de bord."
            footer={<SaveButton onSave={rules.save} dirty={rules.dirty} />}
          >
            <Field
              label="Escalader vers l'administrateur après (heures)"
              hint="Les tickets encore ouverts passent en priorité URGENTE et l'admin est notifié."
            >
              <Input
                type="number"
                className="max-w-[140px]"
                value={s.escalateAfterHours}
                onChange={(e) => rules.set("escalateAfterHours", Number(e.target.value))}
              />
            </Field>
            <Field
              label="Mots-clés haute priorité"
              hint="Séparés par des virgules."
            >
              <Input
                value={s.highPriorityKeywords}
                onChange={(e) => rules.set("highPriorityKeywords", e.target.value)}
                placeholder="fraude, litige, remboursement"
              />
            </Field>
            <ToggleRow
              label="Marquer automatiquement en haute priorité"
              description="Si l'un des mots-clés apparaît dans le sujet ou le message."
              checked={s.autoTagHighPriority}
              onChange={(v) => rules.set("autoTagHighPriority", v)}
            />
          </SettingsSection>
        </TabsContent>

        <TabsContent value="context" className="space-y-4">
          <SettingsSection
            title="Contexte affiché dans le ticket"
            footer={<SaveButton onSave={rules.save} dirty={rules.dirty} />}
          >
            <ToggleRow
              label="Historique des commandes"
              description="Affiche les commandes du client dans le tiroir latéral."
              checked={s.showOrderHistory}
              onChange={(v) => rules.set("showOrderHistory", v)}
            />
            <ToggleRow
              label="Tickets précédents"
              description="Affiche les demandes antérieures du même client."
              checked={s.showPreviousTickets}
              onChange={(v) => rules.set("showPreviousTickets", v)}
            />
            <ToggleRow
              label="Autoriser les commandes de test"
              description="Permet au support de créer des commandes de débogage."
              checked={s.allowTestOrders}
              onChange={(v) => rules.set("allowTestOrders", v)}
            />
          </SettingsSection>

          <SettingsSection
            title="Notifications"
            footer={<SaveButton onSave={notifs.save} dirty={notifs.dirty} />}
          >
            <ToggleRow
              label="Email à chaque nouveau ticket"
              checked={Boolean(n.emailNewTicket)}
              onChange={(v) => notifs.set("emailNewTicket", v)}
            />
            <ToggleRow
              label="Notification push à chaque nouveau ticket"
              checked={Boolean(n.pushNewTicket)}
              onChange={(v) => notifs.set("pushNewTicket", v)}
            />
            <ToggleRow
              label="Récapitulatif quotidien"
              description="Tickets ouverts et clos, chaque matin."
              checked={Boolean(n.dailyTicketSummary)}
              onChange={(v) => notifs.set("dailyTicketSummary", v)}
            />
          </SettingsSection>
        </TabsContent>
      </Tabs>

      {editing && (
        <CannedDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["canned-responses"] })}
        />
      )}
    </div>
  );
}
