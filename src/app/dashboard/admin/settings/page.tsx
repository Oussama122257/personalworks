"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, Eye } from "lucide-react";
import {
  SettingsSection,
  Field,
  ToggleRow,
  ColorField,
  UploadField,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AllSettings {
  general: {
    platformName: string;
    defaultCommissionRate: number;
    ownerShare: number;
    managerShare: number;
    defaultCurrency: "DZD" | "EUR" | "USD";
    defaultLanguage: "fr" | "ar" | "en";
    maintenanceMode: boolean;
  };
  features: Record<string, boolean>;
  shipping: {
    defaultShippingCompany: "YALIDINE" | "ZR_EXPRESS" | "POSTE";
    freeShippingThreshold: number;
    maxDeliveryAttempts: number;
    autoCancelAfterDays: number;
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoLight: string | null;
    logoDark: string | null;
    favicon: string | null;
    customCss: string;
  };
}

interface TemplateDTO {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
  customised: boolean;
  variables: string[];
}

const FEATURE_LABELS: { key: string; label: string; description: string }[] = [
  { key: "aiSearch", label: "Recherche IA", description: "Barre de recherche sémantique." },
  {
    key: "aiProductDescription",
    label: "Description produit IA",
    description: "Bouton « Générer » pour les vendeurs.",
  },
  {
    key: "aiSizeRecommender",
    label: "Recommandation de taille IA",
    description: "Popup de conseil de taille pour les acheteurs.",
  },
  {
    key: "loyaltyPoints",
    label: "Points de fidélité",
    description: "Active tout le système de points.",
  },
  { key: "wishlist", label: "Liste de souhaits", description: "Icône cœur sur les produits." },
  {
    key: "reviewsWithPhotos",
    label: "Avis avec photos",
    description: "Autoriser les avis clients accompagnés d'images.",
  },
  {
    key: "guestCheckout",
    label: "Commande sans compte",
    description: "Commande rapide sans inscription.",
  },
  {
    key: "multiVendorCart",
    label: "Panier multi-vendeurs",
    description: "Plusieurs boutiques dans un même panier.",
  },
];

function TemplateEditor() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: templates } = useQuery<TemplateDTO[]>({
    queryKey: ["admin-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      return data.templates;
    },
  });

  const active = templates?.find((t) => t.key === selected);

  async function save() {
    if (!active || !draft) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: active.key,
          subject: draft.subject,
          bodyHtml: draft.bodyHtml,
          isActive: active.isActive,
        }),
      });
      if (!res.ok) {
        toast.error("Échec de l'enregistrement");
        return;
      }
      toast.success("Modèle enregistré");
      queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
    } finally {
      setBusy(false);
    }
  }

  async function reset(key: string) {
    const res = await fetch(`/api/admin/templates?key=${key}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Modèle réinitialisé");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-1">
        {templates?.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setSelected(t.key);
              setDraft({ subject: t.subject, bodyHtml: t.bodyHtml });
            }}
            className={`w-full rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent ${
              selected === t.key ? "border-primary bg-accent" : ""
            }`}
          >
            <span className="block font-medium">{t.name}</span>
            {t.customised && (
              <Badge variant="secondary" className="mt-1 text-[10px]">
                Personnalisé
              </Badge>
            )}
          </button>
        ))}
      </div>

      <div>
        {!active || !draft ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sélectionnez un modèle à modifier.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Objet</Label>
              <Input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Corps du message (HTML)</Label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={draft.bodyHtml}
                onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles :{" "}
                {active.variables.map((v) => `{{${v}}}`).join(", ")}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> Aperçu
              </p>
              <p className="mb-2 text-sm font-semibold">{draft.subject}</p>
              <div
                className="prose prose-sm max-w-none text-sm [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
              />
            </div>

            <div className="flex gap-2">
              <Button disabled={busy} onClick={save}>
                {busy ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer
              </Button>
              {active.customised && (
                <Button variant="outline" onClick={() => reset(active.key)}>
                  <RotateCcw /> Réinitialiser
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { data } = useQuery<AllSettings>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const json = await res.json();
      return json.settings;
    },
  });

  const general = useSettingsForm(data?.general, "/api/admin/settings", (v) => ({
    group: "general",
    values: v,
  }));
  const features = useSettingsForm(data?.features, "/api/admin/settings", (v) => ({
    group: "features",
    values: v,
  }));
  const shipping = useSettingsForm(data?.shipping, "/api/admin/settings", (v) => ({
    group: "shipping",
    values: v,
  }));
  const theme = useSettingsForm(data?.theme, "/api/admin/settings", (v) => ({
    group: "theme",
    values: v,
  }));

  if (!data) {
    return (
      <div className="container flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const g = general.values;
  const f = features.values;
  const s = shipping.values;
  const t = theme.values;
  const shareTotal = (g?.ownerShare ?? 0) + (g?.managerShare ?? 0);

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Paramètres de la plateforme</h1>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="features">Modules</TabsTrigger>
          <TabsTrigger value="templates">Modèles</TabsTrigger>
          <TabsTrigger value="shipping">Livraison</TabsTrigger>
          <TabsTrigger value="theme">Apparence</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          {g && (
            <SettingsSection
              title="Paramètres globaux"
              description="Identité, commission et langue par défaut de la plateforme."
              footer={<SaveButton onSave={general.save} dirty={general.dirty} />}
            >
              <Field
                label="Nom de la plateforme"
                hint="Utilisé dans les emails et les métadonnées du site."
              >
                <Input
                  value={g.platformName}
                  onChange={(e) => general.set("platformName", e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Commission par défaut (%)">
                  <Input
                    type="number"
                    value={g.defaultCommissionRate}
                    onChange={(e) =>
                      general.set("defaultCommissionRate", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Part propriétaire (%)">
                  <Input
                    type="number"
                    value={g.ownerShare}
                    onChange={(e) => general.set("ownerShare", Number(e.target.value))}
                  />
                </Field>
                <Field label="Part manager (%)">
                  <Input
                    type="number"
                    value={g.managerShare}
                    onChange={(e) => general.set("managerShare", Number(e.target.value))}
                  />
                </Field>
              </div>
              <p
                className={`text-xs ${
                  Math.abs(shareTotal - 100) > 0.01
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                Répartition de la commission : {shareTotal}%
                {Math.abs(shareTotal - 100) > 0.01
                  ? " — le total doit faire exactement 100%."
                  : " ✓"}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Devise par défaut" hint="Affichage seulement — le paiement reste en DZD.">
                  <Select
                    value={g.defaultCurrency}
                    onValueChange={(v) =>
                      general.set("defaultCurrency", v as typeof g.defaultCurrency)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DZD">DZD — Dinar algérien</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                      <SelectItem value="USD">USD — Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Langue par défaut">
                  <Select
                    value={g.defaultLanguage}
                    onValueChange={(v) =>
                      general.set("defaultLanguage", v as typeof g.defaultLanguage)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <ToggleRow
                label="Mode maintenance"
                description="Affiche une page de maintenance à tous les visiteurs sauf les administrateurs."
                checked={g.maintenanceMode}
                onChange={(v) => general.set("maintenanceMode", v)}
              />
            </SettingsSection>
          )}
        </TabsContent>

        <TabsContent value="features">
          {f && (
            <SettingsSection
              title="Modules"
              description="Activez ou désactivez des fonctionnalités pour toute la plateforme."
              footer={<SaveButton onSave={features.save} dirty={features.dirty} />}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {FEATURE_LABELS.map((item) => (
                  <ToggleRow
                    key={item.key}
                    label={item.label}
                    description={item.description}
                    checked={Boolean(f[item.key])}
                    onChange={(v) => features.set(item.key, v)}
                  />
                ))}
              </div>
            </SettingsSection>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <SettingsSection
            title="Modèles d'emails et SMS"
            description="Éditez le HTML et prévisualisez le rendu. Les variables entre accolades sont remplacées à l'envoi."
          >
            <TemplateEditor />
          </SettingsSection>
        </TabsContent>

        <TabsContent value="shipping">
          {s && (
            <SettingsSection
              title="Livraison et logistique"
              description="Valeurs par défaut appliquées quand une boutique n'a pas de réglage propre."
              footer={<SaveButton onSave={shipping.save} dirty={shipping.dirty} />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Transporteur par défaut">
                  <Select
                    value={s.defaultShippingCompany}
                    onValueChange={(v) =>
                      shipping.set(
                        "defaultShippingCompany",
                        v as typeof s.defaultShippingCompany
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YALIDINE">Yalidine</SelectItem>
                      <SelectItem value="ZR_EXPRESS">ZR Express</SelectItem>
                      <SelectItem value="POSTE">Algérie Poste</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Seuil de livraison gratuite (DZD)">
                  <Input
                    type="number"
                    value={s.freeShippingThreshold}
                    onChange={(e) =>
                      shipping.set("freeShippingThreshold", Number(e.target.value))
                    }
                  />
                </Field>
                <Field
                  label="Tentatives de livraison maximum"
                  hint="Au-delà, le colis repart chez le vendeur."
                >
                  <Input
                    type="number"
                    value={s.maxDeliveryAttempts}
                    onChange={(e) =>
                      shipping.set("maxDeliveryAttempts", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Annulation automatique après (jours)">
                  <Input
                    type="number"
                    value={s.autoCancelAfterDays}
                    onChange={(e) =>
                      shipping.set("autoCancelAfterDays", Number(e.target.value))
                    }
                  />
                </Field>
              </div>
            </SettingsSection>
          )}
        </TabsContent>

        <TabsContent value="theme">
          {t && (
            <SettingsSection
              title="Identité visuelle"
              description="Couleurs, logos et CSS personnalisé appliqués au storefront."
              footer={<SaveButton onSave={theme.save} dirty={theme.dirty} />}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorField
                  label="Couleur primaire"
                  value={t.primaryColor}
                  onChange={(v) => theme.set("primaryColor", v)}
                />
                <ColorField
                  label="Couleur secondaire"
                  value={t.secondaryColor}
                  onChange={(v) => theme.set("secondaryColor", v)}
                />
                <ColorField
                  label="Couleur d'accent"
                  value={t.accentColor}
                  onChange={(v) => theme.set("accentColor", v)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <UploadField
                  label="Logo (mode clair)"
                  value={t.logoLight}
                  onChange={(v) => theme.set("logoLight", v)}
                />
                <UploadField
                  label="Logo (mode sombre)"
                  value={t.logoDark}
                  onChange={(v) => theme.set("logoDark", v)}
                />
                <UploadField
                  label="Favicon"
                  value={t.favicon}
                  onChange={(v) => theme.set("favicon", v)}
                />
              </div>

              <Field
                label="CSS personnalisé"
                hint="Injecté dans le storefront. Utilisez-le avec précaution."
              >
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  value={t.customCss}
                  onChange={(e) => theme.set("customCss", e.target.value)}
                  placeholder=":root { --radius: 0.75rem; }"
                />
              </Field>
            </SettingsSection>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
