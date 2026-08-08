"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  SettingsSection,
  Field,
  ToggleRow,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ManagerSettings {
  wilayaCode: number;
  wilayaName: string;
  regional: {
    displayName: string;
    shippingSurcharge: number;
    autoApproveSellers: boolean;
  };
  preferences: {
    notifications: Record<string, boolean>;
    settings: {
      minCommissionPayout: number;
      payoutFrequency: string;
      rib: string;
    };
  };
}

export default function ManagerSettingsPage() {
  const { data } = useQuery<ManagerSettings>({
    queryKey: ["manager-settings"],
    queryFn: async () => {
      const res = await fetch("/api/manager/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const regional = useSettingsForm(data?.regional, "/api/manager/settings", (v) => ({
    regional: v,
  }));
  const payout = useSettingsForm(
    data?.preferences.settings,
    "/api/manager/settings",
    (v) => ({ payout: v })
  );
  const notifs = useSettingsForm(
    data?.preferences.notifications,
    "/api/manager/settings",
    (v) => ({ notifications: v })
  );

  if (!data || !regional.values) {
    return (
      <div className="container flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const r = regional.values;
  const p = payout.values;
  const n = notifs.values ?? {};

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres régionaux</h1>
        <p className="text-sm text-muted-foreground">
          Wilaya {data.wilayaCode} — {data.wilayaName}
        </p>
      </div>

      <SettingsSection
        title="Réglages régionaux"
        description="S'appliquent uniquement à votre wilaya."
        footer={<SaveButton onSave={regional.save} dirty={regional.dirty} />}
      >
        <Field
          label="Nom affiché de la wilaya"
          hint={`Laisser vide pour utiliser « ${data.wilayaName} ».`}
        >
          <Input
            value={r.displayName}
            placeholder={data.wilayaName}
            onChange={(e) => regional.set("displayName", e.target.value)}
          />
        </Field>
        <Field
          label="Supplément de livraison régional (DZD)"
          hint="Ajouté aux frais de livraison pour cette wilaya (zones enclavées)."
        >
          <Input
            type="number"
            value={r.shippingSurcharge}
            onChange={(e) => regional.set("shippingSurcharge", Number(e.target.value))}
          />
        </Field>
        <ToggleRow
          label="Approbation automatique des vendeurs"
          description="Les nouvelles boutiques de votre wilaya sont activées sans passer par la file d'attente."
          checked={r.autoApproveSellers}
          onChange={(v) => regional.set("autoApproveSellers", v)}
        />
      </SettingsSection>

      {p && (
        <SettingsSection
          title="Commission et virements"
          footer={<SaveButton onSave={payout.save} dirty={payout.dirty} />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Seuil minimum de paiement (DZD)"
              hint="Montant requis avant de pouvoir demander un virement."
            >
              <Input
                type="number"
                value={p.minCommissionPayout}
                onChange={(e) => payout.set("minCommissionPayout", Number(e.target.value))}
              />
            </Field>
            <Field label="Fréquence de paiement">
              <Select
                value={p.payoutFrequency}
                onValueChange={(v) => payout.set("payoutFrequency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                  <SelectItem value="BIWEEKLY">Bimensuelle</SelectItem>
                  <SelectItem value="MONTHLY">Mensuelle</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="RIB personnel" hint="Compte crédité de votre part de commission (2%).">
            <Input
              className="font-mono"
              value={p.rib}
              onChange={(e) => payout.set("rib", e.target.value)}
            />
          </Field>
        </SettingsSection>
      )}

      <SettingsSection
        title="Notifications"
        footer={<SaveButton onSave={notifs.save} dirty={notifs.dirty} />}
      >
        <ToggleRow
          label="Inscription d'un nouveau vendeur"
          description="Recevoir un email à chaque nouvelle demande de boutique."
          checked={Boolean(n.newSellerRegistered)}
          onChange={(v) => notifs.set("newSellerRegistered", v)}
        />
        <ToggleRow
          label="Suspension d'une boutique"
          description="Être averti quand une boutique de la wilaya est suspendue."
          checked={Boolean(n.sellerSuspended)}
          onChange={(v) => notifs.set("sellerSuspended", v)}
        />
        <ToggleRow
          label="Rapport quotidien des ventes régionales"
          description="Résumé envoyé chaque matin."
          checked={Boolean(n.dailyRegionalReport)}
          onChange={(v) => notifs.set("dailyRegionalReport", v)}
        />
      </SettingsSection>
    </div>
  );
}
