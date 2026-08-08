"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Activity, Pencil } from "lucide-react";
import {
  SettingsSection,
  Field,
  ToggleRow,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { useWilayas } from "@/hooks/useWilayas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

interface CourierDTO {
  id: string;
  code: string;
  name: string;
  logoUrl: string | null;
  apiEndpoint: string | null;
  apiKeyMasked: string | null;
  hasCredentials: boolean;
  isActive: boolean;
}

interface AgentRow {
  agentId: string;
  name: string;
  phone?: string;
  wilayaCode: number | null;
  successRate: number | null;
  avgHours: number | null;
  totalDelivered: number;
  activeTasks: number;
}

interface LogisticsSettings {
  maxDeliveryRadiusKm: number;
  autoAssignAgent: boolean;
  smartRouting: boolean;
  smsAlertOnAssignment: boolean;
  expressFeePct: number;
  weekendSurcharge: number;
  heavyItemKgThreshold: number;
  heavyItemSurcharge: number;
}

const EMPTY_COURIER = {
  id: "",
  code: "",
  name: "",
  logoUrl: "",
  apiEndpoint: "",
  apiKey: "",
  apiSecret: "",
  isActive: true,
};

function CourierDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: typeof EMPTY_COURIER;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        code: form.code.toUpperCase(),
        name: form.name,
        logoUrl: form.logoUrl || null,
        apiEndpoint: form.apiEndpoint || null,
        ...(form.apiKey ? { apiKey: form.apiKey } : {}),
        ...(form.apiSecret ? { apiSecret: form.apiSecret } : {}),
        isActive: form.isActive,
      };
      const res = await fetch("/api/logistics/couriers", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success(form.id ? "Transporteur mis à jour" : "Transporteur ajouté");
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
            {form.id ? "Modifier le transporteur" : "Nouveau transporteur"}
          </DialogTitle>
          <DialogDescription>
            Les identifiants sont chiffrés avant stockage et ne sont jamais réaffichés.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code" hint="Majuscules, sans espaces.">
              <Input
                className="font-mono uppercase"
                value={form.code}
                disabled={Boolean(form.id)}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="EXPRESS_DZ"
              />
            </Field>
            <Field label="Nom affiché">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Express DZ"
              />
            </Field>
          </div>
          <Field label="URL du logo">
            <Input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            />
          </Field>
          <Field label="Endpoint API" hint="Utilisé par le contrôle de santé.">
            <Input
              value={form.apiEndpoint}
              onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
              placeholder="https://api.transporteur.dz/v1/ping"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Clé API">
              <Input
                type="password"
                value={form.apiKey}
                placeholder={form.id ? "Laisser vide pour conserver" : ""}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
            </Field>
            <Field label="Secret API">
              <Input
                type="password"
                value={form.apiSecret}
                placeholder={form.id ? "Laisser vide pour conserver" : ""}
                onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
              />
            </Field>
          </div>
          <ToggleRow
            label="Transporteur actif"
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />
          <Button
            className="w-full"
            disabled={busy || form.code.length < 2 || form.name.length < 2}
            onClick={save}
          >
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AgentEditDialog({
  agent,
  onClose,
  onSaved,
}: {
  agent: AgentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: wilayas } = useWilayas();
  const [form, setForm] = useState({
    fullName: agent.name,
    phone: agent.phone ?? "",
    wilayaCode: agent.wilayaCode ? String(agent.wilayaCode) : "",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/logistics/agents/${agent.agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          wilayaCode: form.wilayaCode ? Number(form.wilayaCode) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success("Livreur mis à jour");
      onClose();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Modifier le livreur</DialogTitle>
          <DialogDescription>
            Réaffecter une zone change immédiatement les colis qui lui sont proposés.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nom complet">
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Wilaya assignée">
            <Select
              value={form.wilayaCode}
              onValueChange={(v) => setForm({ ...form, wilayaCode: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {wilayas?.map((w) => (
                  <SelectItem key={w.code} value={String(w.code)}>
                    {w.code} — {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button className="w-full" disabled={busy} onClick={save}>
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LogisticsSettingsPage() {
  const queryClient = useQueryClient();
  const [courierDialog, setCourierDialog] = useState<typeof EMPTY_COURIER | null>(null);
  const [agentDialog, setAgentDialog] = useState<AgentRow | null>(null);
  const [probing, setProbing] = useState<string | null>(null);

  const { data: couriersData } = useQuery<{ couriers: CourierDTO[] }>({
    queryKey: ["couriers"],
    queryFn: async () => {
      const res = await fetch("/api/logistics/couriers");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: agentsData } = useQuery<{ agents: AgentRow[] }>({
    queryKey: ["logistics-agents"],
    queryFn: async () => {
      const res = await fetch("/api/logistics/agents");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: settingsData } = useQuery<{ logistics: LogisticsSettings }>({
    queryKey: ["logistics-settings"],
    queryFn: async () => {
      const res = await fetch("/api/logistics/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const rules = useSettingsForm(settingsData?.logistics, "/api/logistics/settings");

  async function toggleCourier(c: CourierDTO, isActive: boolean) {
    const res = await fetch("/api/logistics/couriers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, isActive }),
    });
    if (res.ok) {
      toast.success(isActive ? "Transporteur activé" : "Transporteur désactivé");
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
    }
  }

  async function probe(c: CourierDTO) {
    setProbing(c.id);
    try {
      const res = await fetch("/api/logistics/couriers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      });
      const out = await res.json();
      if (out.online) toast.success(`${c.name} en ligne (${out.latencyMs} ms)`);
      else if (!out.configured) toast.warning(out.error);
      else toast.error(`${c.name} : ${out.error}`);
    } finally {
      setProbing(null);
    }
  }

  const r = rules.values;

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Paramètres logistiques</h1>

      <Tabs defaultValue="couriers">
        <TabsList>
          <TabsTrigger value="couriers">Transporteurs</TabsTrigger>
          <TabsTrigger value="agents">Livreurs</TabsTrigger>
          <TabsTrigger value="rules">Règles de livraison</TabsTrigger>
        </TabsList>

        <TabsContent value="couriers">
          <SettingsSection
            title="Transporteurs"
            description="Ajoutez vos propres transporteurs en plus de ceux fournis par la plateforme."
            footer={
              <Button
                variant="outline"
                onClick={() => setCourierDialog({ ...EMPTY_COURIER })}
              >
                <Plus /> Ajouter un transporteur
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Clé</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {couriersData?.couriers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {c.apiEndpoint ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.hasCredentials ? (
                        <span className="font-mono">{c.apiKeyMasked}</span>
                      ) : (
                        <Badge variant="secondary">Aucune</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.isActive}
                        onCheckedChange={(v) => toggleCourier(c, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={probing === c.id}
                        title="Tester l'API"
                        onClick={() => probe(c)}
                      >
                        {probing === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Activity className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCourierDialog({
                            id: c.id,
                            code: c.code,
                            name: c.name,
                            logoUrl: c.logoUrl ?? "",
                            apiEndpoint: c.apiEndpoint ?? "",
                            apiKey: "",
                            apiSecret: "",
                            isActive: c.isActive,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm(`Supprimer ${c.name} ?`)) return;
                          await fetch(`/api/logistics/couriers?id=${c.id}`, {
                            method: "DELETE",
                          });
                          toast.success("Transporteur supprimé");
                          queryClient.invalidateQueries({ queryKey: ["couriers"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!couriersData || couriersData.couriers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucun transporteur personnalisé — les transporteurs intégrés
                      (Yalidine, ZR Express, Poste) restent disponibles.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="agents">
          <SettingsSection
            title="Livreurs"
            description="Créez les comptes depuis le tableau de bord administrateur ; modifiez ici leur zone et leurs coordonnées."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead className="text-right">Livrés</TableHead>
                  <TableHead className="text-right">En cours</TableHead>
                  <TableHead className="text-right">Réussite</TableHead>
                  <TableHead className="text-right">Temps moyen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentsData?.agents.map((a) => (
                  <TableRow key={a.agentId}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.wilayaCode ?? "—"}</TableCell>
                    <TableCell className="text-right">{a.totalDelivered}</TableCell>
                    <TableCell className="text-right">{a.activeTasks}</TableCell>
                    <TableCell className="text-right">
                      {a.successRate === null ? "—" : `${a.successRate}%`}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.avgHours === null ? "—" : `${a.avgHours} h`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setAgentDialog(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!agentsData || agentsData.agents.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Aucun livreur enregistré
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          {r && (
            <>
              <SettingsSection
                title="Règles d'affectation"
                footer={<SaveButton onSave={rules.save} dirty={rules.dirty} />}
              >
                <Field
                  label="Rayon de livraison maximum (km)"
                  hint="Limite la distance entre un livreur et sa destination."
                >
                  <Input
                    type="number"
                    className="max-w-[160px]"
                    value={r.maxDeliveryRadiusKm}
                    onChange={(e) => rules.set("maxDeliveryRadiusKm", Number(e.target.value))}
                  />
                </Field>
                <ToggleRow
                  label="Affectation automatique"
                  description="Assigne le livreur le moins chargé de la wilaya à chaque nouveau colis."
                  checked={r.autoAssignAgent}
                  onChange={(v) => rules.set("autoAssignAgent", v)}
                />
                <ToggleRow
                  label="Routage intelligent"
                  description="Départage les livreurs à charge égale par proximité GPS."
                  checked={r.smartRouting}
                  onChange={(v) => rules.set("smartRouting", v)}
                />
                <ToggleRow
                  label="SMS au livreur lors de l'affectation"
                  description="Nécessite un fournisseur SMS configuré."
                  checked={r.smsAlertOnAssignment}
                  onChange={(v) => rules.set("smsAlertOnAssignment", v)}
                />
              </SettingsSection>

              <SettingsSection
                title="Priorité et suppléments"
                footer={<SaveButton onSave={rules.save} dirty={rules.dirty} />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Supplément express 24h (%)">
                    <Input
                      type="number"
                      value={r.expressFeePct}
                      onChange={(e) => rules.set("expressFeePct", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Supplément week-end / jour férié (DZD)">
                    <Input
                      type="number"
                      value={r.weekendSurcharge}
                      onChange={(e) => rules.set("weekendSurcharge", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Seuil colis lourd (kg)">
                    <Input
                      type="number"
                      value={r.heavyItemKgThreshold}
                      onChange={(e) =>
                        rules.set("heavyItemKgThreshold", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Supplément colis lourd (DZD)">
                    <Input
                      type="number"
                      value={r.heavyItemSurcharge}
                      onChange={(e) => rules.set("heavyItemSurcharge", Number(e.target.value))}
                    />
                  </Field>
                </div>
              </SettingsSection>
            </>
          )}
        </TabsContent>
      </Tabs>

      {courierDialog && (
        <CourierDialog
          initial={courierDialog}
          onClose={() => setCourierDialog(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["couriers"] })}
        />
      )}
      {agentDialog && (
        <AgentEditDialog
          agent={agentDialog}
          onClose={() => setAgentDialog(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["logistics-agents"] })}
        />
      )}
    </div>
  );
}
