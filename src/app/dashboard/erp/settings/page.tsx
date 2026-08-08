"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  SettingsSection,
  Field,
  ToggleRow,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { Input } from "@/components/ui/input";
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

interface ErpSettings {
  csvDelimiter: string;
  autoPublishImported: boolean;
  exportFilenamePattern: string;
  exportFields: string[];
  aiAutoTagging: boolean;
  aiConfidenceThreshold: number;
}

interface AttributeDTO {
  id: string;
  name: string;
  type: string;
  values: { id: string; value: string; hexCode: string | null }[];
}

const ALL_EXPORT_FIELDS = [
  "store_slug",
  "product_name",
  "category",
  "description",
  "sku",
  "size",
  "color",
  "price",
  "stock",
  "low_stock_threshold",
  "published",
];

const ATTRIBUTE_TYPES = [
  ["SIZE", "Taille"],
  ["COLOR", "Couleur"],
  ["FABRIC", "Matière"],
  ["OTHER", "Autre (ex : saison)"],
] as const;

function AttributeManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", type: "SIZE", values: "", hex: "#000000" });

  const { data: attributes } = useQuery<AttributeDTO[]>({
    queryKey: ["erp-attributes"],
    queryFn: async () => {
      const res = await fetch("/api/erp/attributes");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data.attributes;
    },
  });

  async function add() {
    const values = form.values
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const res = await fetch("/api/erp/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        values,
        hexCode: form.type === "COLOR" ? form.hex : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Échec");
      return;
    }
    toast.success(data.merged ? "Valeurs ajoutées" : "Attribut créé");
    setForm({ name: "", type: form.type, values: "", hex: "#000000" });
    queryClient.invalidateQueries({ queryKey: ["erp-attributes"] });
  }

  async function removeValue(valueId: string) {
    await fetch("/api/erp/attributes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueId }),
    });
    queryClient.invalidateQueries({ queryKey: ["erp-attributes"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Type">
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTRIBUTE_TYPES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nom de l'attribut">
          <Input
            className="w-[200px]"
            value={form.name}
            placeholder="Ex : Taille vêtement"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Valeurs (séparées par des virgules)">
          <Input
            className="w-[260px]"
            value={form.values}
            placeholder={form.type === "COLOR" ? "Rouge, Bleu, Vert" : "S, M, L, XL"}
            onChange={(e) => setForm({ ...form, values: e.target.value })}
          />
        </Field>
        {form.type === "COLOR" && (
          <Field label="Code HEX">
            <input
              type="color"
              value={form.hex}
              onChange={(e) => setForm({ ...form, hex: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
            />
          </Field>
        )}
        <Button disabled={form.name.length < 1} onClick={add}>
          <Plus /> Ajouter
        </Button>
      </div>

      <div className="space-y-4">
        {attributes?.map((a) => (
          <div key={a.id}>
            <p className="mb-1 text-sm font-medium">
              {a.name} <span className="text-xs text-muted-foreground">({a.type})</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {a.values.map((v) => (
                <button key={v.id} onClick={() => removeValue(v.id)} title="Cliquer pour supprimer">
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {v.hexCode && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border"
                        style={{ backgroundColor: v.hexCode }}
                      />
                    )}
                    {v.value}
                  </Badge>
                </button>
              ))}
              {a.values.length === 0 && (
                <span className="text-xs text-muted-foreground">Aucune valeur</span>
              )}
            </div>
          </div>
        ))}
        {(!attributes || attributes.length === 0) && (
          <p className="text-sm text-muted-foreground">Aucun attribut défini.</p>
        )}
      </div>
    </div>
  );
}

export default function ErpSettingsPage() {
  const { data } = useQuery<{ erp: ErpSettings }>({
    queryKey: ["erp-settings"],
    queryFn: async () => {
      const res = await fetch("/api/erp/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const form = useSettingsForm(data?.erp, "/api/erp/settings");

  if (!data || !form.values) {
    return (
      <div className="container flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const e = form.values;

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Paramètres du catalogue</h1>

      <Tabs defaultValue="attributes">
        <TabsList>
          <TabsTrigger value="attributes">Dictionnaire d&apos;attributs</TabsTrigger>
          <TabsTrigger value="io">Import / Export</TabsTrigger>
          <TabsTrigger value="ai">Étiquetage IA</TabsTrigger>
        </TabsList>

        <TabsContent value="attributes">
          <SettingsSection
            title="Données de référence globales"
            description="Tailles, couleurs, matières et saisons proposées aux vendeurs. Cliquez sur une valeur pour la supprimer."
          >
            <AttributeManager />
          </SettingsSection>
        </TabsContent>

        <TabsContent value="io">
          <SettingsSection
            title="Valeurs par défaut d'import et d'export"
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Séparateur CSV à l'import">
                <Select
                  value={e.csvDelimiter}
                  onValueChange={(v) => form.set("csvDelimiter", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Virgule ( , )</SelectItem>
                    <SelectItem value=";">Point-virgule ( ; )</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Modèle de nom de fichier export"
                hint="Jeton disponible : {YYYYMMDD}."
              >
                <Input
                  className="font-mono text-xs"
                  value={e.exportFilenamePattern}
                  onChange={(e2) => form.set("exportFilenamePattern", e2.target.value)}
                />
              </Field>
            </div>

            <ToggleRow
              label="Publier automatiquement les produits importés"
              description="Sinon, les produits arrivent en brouillon et doivent être publiés manuellement."
              checked={e.autoPublishImported}
              onChange={(v) => form.set("autoPublishImported", v)}
            />

            <div className="space-y-2">
              <Label>Colonnes incluses dans l&apos;export</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_EXPORT_FIELDS.map((field) => {
                  const checked = e.exportFields.includes(field);
                  return (
                    <label
                      key={field}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          form.set(
                            "exportFields",
                            checked
                              ? e.exportFields.filter((f) => f !== field)
                              : [...e.exportFields, field]
                          )
                        }
                      />
                      <span className="font-mono">{field}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="ai">
          <SettingsSection
            title="Étiquetage automatique par IA"
            description="Attribue catégories et tags à partir du nom et de la description. Nécessite OPENAI_API_KEY."
            footer={<SaveButton onSave={form.save} dirty={form.dirty} />}
          >
            <ToggleRow
              label="Activer l'étiquetage IA"
              checked={e.aiAutoTagging}
              onChange={(v) => form.set("aiAutoTagging", v)}
            />
            <Field
              label="Seuil de confiance (%)"
              hint="En dessous de ce seuil, la suggestion est ignorée."
            >
              <Input
                type="number"
                className="max-w-[140px]"
                value={e.aiConfidenceThreshold}
                onChange={(e2) => form.set("aiConfidenceThreshold", Number(e2.target.value))}
              />
            </Field>
          </SettingsSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
