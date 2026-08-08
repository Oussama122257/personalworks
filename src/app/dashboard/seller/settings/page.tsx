"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, PlugZap } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoreSettings {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  contactPhone: string | null;
  address: string | null;
  socialLinks: Record<string, string>;
  deliveryProviderType: string;
  customProviderName: string | null;
  customAccountNumber: string | null;
  customApiKeyMasked: string | null;
  hasCustomCredentials: boolean;
  processingTime: string;
  freeShippingThreshold: number | null;
  defaultStockThreshold: number;
  defaultTaxRate: number;
  skuPattern: string;
  aiDescriptionEnabled: boolean;
  autoConfirmOrders: boolean;
  autoPrintWaybill: boolean;
  defaultCourier: string;
  rib: string | null;
  minPayoutThreshold: number;
  payoutFrequency: string;
  invoiceDetails: string | null;
  returnPolicy: string | null;
  returnWindowDays: number;
  returnShippingFee: string;
}

interface Prefs {
  notifications: Record<string, boolean>;
}

export default function SellerSettingsPage() {
  const [creds, setCreds] = useState({ apiKey: "", apiSecret: "" });
  const [testing, setTesting] = useState(false);

  const { data } = useQuery<{ store: StoreSettings; preferences: Prefs }>({
    queryKey: ["seller-settings"],
    queryFn: async () => {
      const res = await fetch("/api/seller/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const form = useSettingsForm(data?.store, "/api/seller/settings", (v) => ({
    name: v.name,
    logoUrl: v.logoUrl,
    bannerUrl: v.bannerUrl,
    description: v.description ?? undefined,
    contactPhone: v.contactPhone,
    address: v.address ?? undefined,
    socialLinks: v.socialLinks,
    deliveryProviderType: v.deliveryProviderType,
    customProviderName: v.customProviderName,
    customAccountNumber: v.customAccountNumber,
    processingTime: v.processingTime,
    freeShippingThreshold: v.freeShippingThreshold,
    defaultStockThreshold: v.defaultStockThreshold,
    defaultTaxRate: v.defaultTaxRate,
    skuPattern: v.skuPattern,
    aiDescriptionEnabled: v.aiDescriptionEnabled,
    autoConfirmOrders: v.autoConfirmOrders,
    autoPrintWaybill: v.autoPrintWaybill,
    defaultCourier: v.defaultCourier,
    rib: v.rib,
    minPayoutThreshold: v.minPayoutThreshold,
    payoutFrequency: v.payoutFrequency,
    invoiceDetails: v.invoiceDetails,
    returnPolicy: v.returnPolicy,
    returnWindowDays: v.returnWindowDays,
    returnShippingFee: v.returnShippingFee,
  }));

  const notifs = useSettingsForm(
    data?.preferences.notifications,
    "/api/preferences",
    (v) => ({ notifications: v })
  );

  if (!data || !form.values) {
    return (
      <div className="container flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const s = form.values;
  const n = notifs.values ?? {};
  const isCustom = s.deliveryProviderType === "CUSTOM";

  async function saveCredentials() {
    const res = await fetch("/api/seller/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customApiKey: creds.apiKey || undefined,
        customApiSecret: creds.apiSecret || undefined,
      }),
    });
    if (res.ok) {
      toast.success("Identifiants chiffrés et enregistrés");
      setCreds({ apiKey: "", apiSecret: "" });
    } else {
      toast.error("Échec de l'enregistrement");
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/seller/test-connection", { method: "POST" });
      const out = await res.json();
      if (out.online) toast.success(`Connexion réussie (${out.latencyMs} ms)`);
      else if (!out.configured) toast.warning(out.error ?? "Transporteur non configuré");
      else toast.error(`Échec : ${out.error}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Paramètres de la boutique</h1>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="shipping">Livraison</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="orders">Commandes</TabsTrigger>
          <TabsTrigger value="finance">Finances</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="returns">Retours</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <SettingsSection
            title="Profil de la boutique"
            description={`URL actuelle : /store/${s.slug} — renommer la boutique régénère ce lien.`}
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <Field label="Nom de la boutique">
              <Input value={s.name} onChange={(e) => form.set("name", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadField
                label="Logo"
                value={s.logoUrl}
                onChange={(v) => form.set("logoUrl", v)}
                hint="PNG ou JPG, 2 Mo maximum."
              />
              <UploadField
                label="Bannière"
                value={s.bannerUrl}
                onChange={(v) => form.set("bannerUrl", v)}
                hint="Image large affichée en tête de boutique."
              />
            </div>
            <Field label="Description" hint="Le HTML simple est accepté.">
              <Textarea
                rows={4}
                value={s.description ?? ""}
                onChange={(e) => form.set("description", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone de la boutique" hint="Distinct de votre numéro personnel.">
                <Input
                  value={s.contactPhone ?? ""}
                  onChange={(e) => form.set("contactPhone", e.target.value)}
                />
              </Field>
              <Field label="Adresse physique (ramassage)">
                <Input
                  value={s.address ?? ""}
                  onChange={(e) => form.set("address", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["facebook", "instagram", "tiktok", "youtube"] as const).map((net) => (
                <Field key={net} label={net.charAt(0).toUpperCase() + net.slice(1)}>
                  <Input
                    value={s.socialLinks?.[net] ?? ""}
                    placeholder={`https://${net}.com/…`}
                    onChange={(e) =>
                      form.set("socialLinks", { ...s.socialLinks, [net]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="shipping">
          <SettingsSection
            title="Livraison"
            description="Les identifiants transporteur sont chiffrés avant stockage et ne sont jamais renvoyés en clair."
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <Field label="Type de fournisseur">
              <Select
                value={s.deliveryProviderType}
                onValueChange={(v) => form.set("deliveryProviderType", v)}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZEEM_DEFAULT">Zeem (par défaut)</SelectItem>
                  <SelectItem value="YALIDINE">Yalidine</SelectItem>
                  <SelectItem value="ZR_EXPRESS">ZR Express</SelectItem>
                  <SelectItem value="POSTE">Algérie Poste</SelectItem>
                  <SelectItem value="CUSTOM">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {isCustom && (
              <div className="max-w-md space-y-3 rounded-lg border p-4">
                <Field label="Nom du fournisseur">
                  <Input
                    value={s.customProviderName ?? ""}
                    placeholder="Express DZ"
                    onChange={(e) => form.set("customProviderName", e.target.value)}
                  />
                </Field>
                <Field label="Numéro de compte">
                  <Input
                    value={s.customAccountNumber ?? ""}
                    onChange={(e) => form.set("customAccountNumber", e.target.value)}
                  />
                </Field>
                {s.hasCustomCredentials && (
                  <p className="text-xs text-muted-foreground">
                    Clé enregistrée : {s.customApiKeyMasked} (chiffrée)
                  </p>
                )}
                <Field label="Clé API">
                  <Input
                    type="password"
                    value={creds.apiKey}
                    placeholder="Laisser vide pour conserver"
                    onChange={(e) => setCreds({ ...creds, apiKey: e.target.value })}
                  />
                </Field>
                <Field label="Secret API">
                  <Input
                    type="password"
                    value={creds.apiSecret}
                    placeholder="Laisser vide pour conserver"
                    onChange={(e) => setCreds({ ...creds, apiSecret: e.target.value })}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!creds.apiKey && !creds.apiSecret}
                    onClick={saveCredentials}
                  >
                    Enregistrer les identifiants
                  </Button>
                  <Button size="sm" variant="outline" disabled={testing} onClick={testConnection}>
                    {testing ? <Loader2 className="animate-spin" /> : <PlugZap />}
                    Tester la connexion
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Délai de préparation">
                <Select
                  value={s.processingTime}
                  onValueChange={(v) => form.set("processingTime", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24 heures</SelectItem>
                    <SelectItem value="48h">48 heures</SelectItem>
                    <SelectItem value="72h">72 heures</SelectItem>
                    <SelectItem value="5j">5 jours</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Seuil de livraison gratuite (DZD)"
                hint="Laisser vide pour utiliser le seuil global de la plateforme."
              >
                <Input
                  type="number"
                  value={s.freeShippingThreshold ?? ""}
                  onChange={(e) =>
                    form.set(
                      "freeShippingThreshold",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </Field>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="products">
          <SettingsSection
            title="Valeurs par défaut des produits"
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Seuil d'alerte de stock" hint="Modifiable produit par produit.">
                <Input
                  type="number"
                  value={s.defaultStockThreshold}
                  onChange={(e) => form.set("defaultStockThreshold", Number(e.target.value))}
                />
              </Field>
              <Field label="Taux de TVA par défaut (%)">
                <Input
                  type="number"
                  value={s.defaultTaxRate}
                  onChange={(e) => form.set("defaultTaxRate", Number(e.target.value))}
                />
              </Field>
            </div>
            <Field
              label="Modèle de SKU automatique"
              hint="Jetons disponibles : {STORE}, {CAT}, {COLOR}, {SIZE}."
            >
              <Input
                className="font-mono text-xs"
                value={s.skuPattern}
                onChange={(e) => form.set("skuPattern", e.target.value)}
              />
            </Field>
            <ToggleRow
              label="Bouton « Générer avec l'IA »"
              description="Affiche l'assistant de description sur la page produit."
              checked={s.aiDescriptionEnabled}
              onChange={(v) => form.set("aiDescriptionEnabled", v)}
            />
          </SettingsSection>
        </TabsContent>

        <TabsContent value="orders">
          <SettingsSection
            title="Commandes et préparation"
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <ToggleRow
              label="Confirmer les commandes automatiquement"
              description="Sinon, chaque commande demande une validation manuelle."
              checked={s.autoConfirmOrders}
              onChange={(v) => form.set("autoConfirmOrders", v)}
            />
            <ToggleRow
              label="Imprimer le bordereau automatiquement"
              description="Ouvre la boîte d'impression dès la confirmation."
              checked={s.autoPrintWaybill}
              onChange={(v) => form.set("autoPrintWaybill", v)}
            />
            <Field label="Transporteur par défaut pour les ramassages">
              <Select
                value={s.defaultCourier}
                onValueChange={(v) => form.set("defaultCourier", v)}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YALIDINE">Yalidine</SelectItem>
                  <SelectItem value="ZR_EXPRESS">ZR Express</SelectItem>
                  <SelectItem value="POSTE">Algérie Poste</SelectItem>
                  {s.customProviderName && (
                    <SelectItem value="CUSTOM">{s.customProviderName}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="finance">
          <SettingsSection
            title="Paiements et facturation"
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <Field label="RIB" hint="Compte bancaire crédité lors des virements.">
              <Input
                className="font-mono"
                value={s.rib ?? ""}
                onChange={(e) => form.set("rib", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Seuil minimum de virement (DZD)">
                <Input
                  type="number"
                  value={s.minPayoutThreshold}
                  onChange={(e) => form.set("minPayoutThreshold", Number(e.target.value))}
                />
              </Field>
              <Field label="Fréquence des virements">
                <Select
                  value={s.payoutFrequency}
                  onValueChange={(v) => form.set("payoutFrequency", v)}
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
            <Field label="Mentions sur les factures" hint="Ex : N° de TVA, RC, adresse fiscale.">
              <Textarea
                rows={3}
                value={s.invoiceDetails ?? ""}
                onChange={(e) => form.set("invoiceDetails", e.target.value)}
              />
            </Field>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="notifications">
          <SettingsSection
            title="Notifications"
            footer={<SaveButton onSave={notifs.save} dirty={notifs.dirty} />}
          >
            <ToggleRow
              label="Email à chaque nouvelle commande"
              checked={Boolean(n.emailNewOrder)}
              onChange={(v) => notifs.set("emailNewOrder", v)}
            />
            <ToggleRow
              label="SMS à chaque nouvelle commande"
              checked={Boolean(n.smsNewOrder)}
              onChange={(v) => notifs.set("smsNewOrder", v)}
            />
            <ToggleRow
              label="Email d'alerte de stock"
              checked={Boolean(n.emailStockAlert)}
              onChange={(v) => notifs.set("emailStockAlert", v)}
            />
            <ToggleRow
              label="Rapport de ventes hebdomadaire"
              checked={Boolean(n.emailWeeklyReport)}
              onChange={(v) => notifs.set("emailWeeklyReport", v)}
            />
          </SettingsSection>
        </TabsContent>

        <TabsContent value="returns">
          <SettingsSection
            title="Retours et remboursements"
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <Field label="Politique de retour">
              <Textarea
                rows={5}
                value={s.returnPolicy ?? ""}
                onChange={(e) => form.set("returnPolicy", e.target.value)}
                placeholder="Décrivez les conditions et la marche à suivre pour un retour…"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Délai de retour (jours)">
                <Input
                  type="number"
                  value={s.returnWindowDays}
                  onChange={(e) => form.set("returnWindowDays", Number(e.target.value))}
                />
              </Field>
              <Field label="Frais de retour à la charge de">
                <Select
                  value={s.returnShippingFee}
                  onValueChange={(v) => form.set("returnShippingFee", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUYER_PAYS">L&apos;acheteur</SelectItem>
                    <SelectItem value="SELLER_PAYS">Le vendeur</SelectItem>
                    <SelectItem value="FREE">Gratuit</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </SettingsSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
