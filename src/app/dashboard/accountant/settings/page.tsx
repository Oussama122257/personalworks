"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  SettingsSection,
  Field,
  ToggleRow,
  UploadField,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountantSettings {
  fiscal: {
    vatRate: number;
    invoiceFooter: string;
    invoiceLogo: string | null;
    invoiceNumberFormat: string;
  };
  payouts: {
    autoGenerateBatches: boolean;
    batchDay: string;
    minSellerBalance: number;
    bankFileFormat: string;
    csvDelimiter: string;
  };
  reconciliation: {
    codTolerancePct: number;
    autoFlagDiscrepancies: boolean;
    dailyReminder: boolean;
  };
}

const DAYS = [
  ["MONDAY", "Lundi"],
  ["TUESDAY", "Mardi"],
  ["WEDNESDAY", "Mercredi"],
  ["THURSDAY", "Jeudi"],
  ["FRIDAY", "Vendredi"],
  ["SATURDAY", "Samedi"],
  ["SUNDAY", "Dimanche"],
] as const;

export default function AccountantSettingsPage() {
  const { data } = useQuery<AccountantSettings>({
    queryKey: ["accountant-settings"],
    queryFn: async () => {
      const res = await fetch("/api/accountant/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const fiscal = useSettingsForm(data?.fiscal, "/api/accountant/settings", (v) => ({
    fiscal: v,
  }));
  const payouts = useSettingsForm(data?.payouts, "/api/accountant/settings", (v) => ({
    payouts: v,
  }));
  const recon = useSettingsForm(data?.reconciliation, "/api/accountant/settings", (v) => ({
    reconciliation: v,
  }));

  if (!data || !fiscal.values || !payouts.values || !recon.values) {
    return (
      <div className="container flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const f = fiscal.values;
  const p = payouts.values;
  const r = recon.values;

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <h1 className="text-2xl font-bold">Paramètres comptables</h1>

      <SettingsSection
        title="Fiscalité et factures"
        description="Le taux de TVA est appliqué aux commissions dans la réconciliation et les factures."
        footer={<SaveButton onSave={fiscal.save} dirty={fiscal.dirty} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Taux de TVA (%)">
            <Input
              type="number"
              value={f.vatRate}
              onChange={(e) => fiscal.set("vatRate", Number(e.target.value))}
            />
          </Field>
          <Field
            label="Format de numéro de facture"
            hint="Jetons : {YYYY}, {MM}, {SEQ}."
          >
            <Input
              className="font-mono text-xs"
              value={f.invoiceNumberFormat}
              onChange={(e) => fiscal.set("invoiceNumberFormat", e.target.value)}
            />
          </Field>
        </div>
        <UploadField
          label="Logo sur les factures"
          value={f.invoiceLogo}
          onChange={(v) => fiscal.set("invoiceLogo", v)}
        />
        <Field label="Mentions légales en pied de facture">
          <Textarea
            rows={3}
            value={f.invoiceFooter}
            onChange={(e) => fiscal.set("invoiceFooter", e.target.value)}
          />
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Automatisation des virements"
        footer={<SaveButton onSave={payouts.save} dirty={payouts.dirty} />}
      >
        <ToggleRow
          label="Générer les lots automatiquement"
          description="Crée un lot de virements à la fréquence choisie. Nécessite un ordonnanceur externe (voir README)."
          checked={p.autoGenerateBatches}
          onChange={(v) => payouts.set("autoGenerateBatches", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jour de génération">
            <Select value={p.batchDay} onValueChange={(v) => payouts.set("batchDay", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Solde vendeur minimum (DZD)">
            <Input
              type="number"
              value={p.minSellerBalance}
              onChange={(e) => payouts.set("minSellerBalance", Number(e.target.value))}
            />
          </Field>
          <Field label="Format du fichier bancaire">
            <Select
              value={p.bankFileFormat}
              onValueChange={(v) => payouts.set("bankFileFormat", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="EXCEL">Excel</SelectItem>
                <SelectItem value="XML">XML</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Séparateur CSV">
            <Select
              value={p.csvDelimiter}
              onValueChange={(v) => payouts.set("csvDelimiter", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Virgule ( , )</SelectItem>
                <SelectItem value=";">Point-virgule ( ; )</SelectItem>
                <SelectItem value="&#9;">Tabulation</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Réconciliation COD"
        footer={<SaveButton onSave={recon.save} dirty={recon.dirty} />}
      >
        <Field
          label="Tolérance d'encaissement (%)"
          hint="Au-delà de cet écart, la livraison est signalée dans le tableau de bord."
        >
          <Input
            type="number"
            step="0.1"
            value={r.codTolerancePct}
            onChange={(e) => recon.set("codTolerancePct", Number(e.target.value))}
          />
        </Field>
        <ToggleRow
          label="Signaler automatiquement les écarts"
          checked={r.autoFlagDiscrepancies}
          onChange={(v) => recon.set("autoFlagDiscrepancies", v)}
        />
        <ToggleRow
          label="Rappel quotidien de réconciliation"
          description="Email envoyé chaque matin tant que des écarts subsistent."
          checked={r.dailyReminder}
          onChange={(v) => recon.set("dailyReminder", v)}
        />
      </SettingsSection>
    </div>
  );
}
