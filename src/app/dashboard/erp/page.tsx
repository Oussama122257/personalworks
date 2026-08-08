"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Upload,
  Download,
  FolderTree,
  Tags,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  children: CategoryNode[];
}

interface AttributeDTO {
  id: string;
  name: string;
  type: string;
  values: { id: string; value: string }[];
}

function SortableCategory({
  node,
  depth,
  onDelete,
}: {
  node: CategoryNode;
  depth: number;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: depth * 20,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="mb-1 flex items-center gap-2 rounded-md border bg-background p-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm">{node.name}</span>
      <span className="text-xs text-muted-foreground">{node.slug}</span>
      <Button variant="ghost" size="icon" onClick={() => onDelete(node.id)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function CategoryBranch({
  nodes,
  depth,
  onReorder,
  onDelete,
}: {
  nodes: CategoryNode[];
  depth: number;
  onReorder: (parentId: string | null, ordered: CategoryNode[]) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = nodes.findIndex((n) => n.id === active.id);
    const newIndex = nodes.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(nodes[0]?.parentId ?? null, arrayMove(nodes, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => (
          <div key={node.id}>
            <SortableCategory node={node} depth={depth} onDelete={onDelete} />
            {node.children.length > 0 && (
              <CategoryBranch
                nodes={node.children}
                depth={depth + 1}
                onReorder={onReorder}
                onDelete={onDelete}
              />
            )}
          </div>
        ))}
      </SortableContext>
    </DndContext>
  );
}

export default function ErpDashboard() {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: "", parentId: "root" });
  const [newAttribute, setNewAttribute] = useState({ name: "", type: "SIZE", values: "" });

  const { data: catData } = useQuery<{ categories: CategoryNode[]; flat: CategoryNode[] }>({
    queryKey: ["erp-categories"],
    queryFn: async () => {
      const res = await fetch("/api/erp/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
  });

  const { data: attributes } = useQuery<AttributeDTO[]>({
    queryKey: ["erp-attributes"],
    queryFn: async () => {
      const res = await fetch("/api/erp/attributes");
      if (!res.ok) throw new Error("Failed to load attributes");
      const data = await res.json();
      return data.attributes;
    },
  });

  async function handleImport(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/erp/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setImportResult(data.error ?? "Import échoué");
        toast.error("Import annulé — aucune donnée modifiée");
        return;
      }
      setImportResult(
        `${data.rows} ligne(s) traitées : ${data.productsCreated} produits créés, ${data.productsUpdated} mis à jour, ${data.variantsCreated} variantes créées, ${data.variantsUpdated} mises à jour.`
      );
      toast.success("Import réussi");
      queryClient.invalidateQueries();
    } finally {
      setImporting(false);
    }
  }

  async function addCategory() {
    const res = await fetch("/api/erp/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCategory.name,
        parentId: newCategory.parentId === "root" ? null : newCategory.parentId,
      }),
    });
    if (!res.ok) {
      toast.error("Échec de la création");
      return;
    }
    toast.success("Catégorie créée");
    setNewCategory({ name: "", parentId: "root" });
    queryClient.invalidateQueries({ queryKey: ["erp-categories"] });
  }

  async function reorder(parentId: string | null, ordered: CategoryNode[]) {
    const res = await fetch("/api/erp/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: ordered.map((n, i) => ({ id: n.id, position: i, parentId })),
      }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["erp-categories"] });
    } else {
      toast.error("Échec du réordonnancement");
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Désactiver cette catégorie et ses sous-catégories ?")) return;
    const res = await fetch(`/api/erp/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Échec");
      return;
    }
    toast.success(`${data.deactivated} catégorie(s) désactivée(s)`);
    queryClient.invalidateQueries({ queryKey: ["erp-categories"] });
  }

  async function addAttribute() {
    const res = await fetch("/api/erp/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newAttribute.name,
        type: newAttribute.type,
        values: newAttribute.values
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Échec");
      return;
    }
    toast.success(data.merged ? "Valeurs ajoutées à l'attribut existant" : "Attribut créé");
    setNewAttribute({ name: "", type: "SIZE", values: "" });
    queryClient.invalidateQueries({ queryKey: ["erp-attributes"] });
  }

  async function deleteValue(valueId: string) {
    const res = await fetch("/api/erp/attributes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueId }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["erp-attributes"] });
    }
  }

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Opérations catalogue (ERP)</h1>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import / Export</TabsTrigger>
          <TabsTrigger value="categories">Arborescence</TabsTrigger>
          <TabsTrigger value="attributes">Attributs</TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Import CSV du catalogue
              </CardTitle>
              <CardDescription>
                Colonnes attendues : store_slug, product_name, category, description,
                sku, size, color, price, stock, low_stock_threshold, published.
                L&apos;import est transactionnel — si une ligne échoue, rien n&apos;est écrit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label
                htmlFor="csv-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-sm text-muted-foreground hover:bg-accent"
              >
                {importing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
                {importing
                  ? "Import en cours…"
                  : "Glissez un fichier CSV ici, ou cliquez pour choisir"}
              </Label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                  e.target.value = "";
                }}
              />

              {importResult && (
                <p className="rounded-md border bg-muted p-3 text-sm">{importResult}</p>
              )}

              <Button asChild variant="outline">
                <a href="/api/erp/export" download>
                  <Download /> Exporter tout le catalogue
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-4 w-4" /> Arborescence des catégories
              </CardTitle>
              <CardDescription>
                Glissez-déposez pour réordonner (Femme → Robes → Cérémonie).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom</Label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="Ex : Robes"
                    className="w-[200px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Parent</Label>
                  <Select
                    value={newCategory.parentId}
                    onValueChange={(v) => setNewCategory({ ...newCategory, parentId: v })}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">— Racine —</SelectItem>
                      {catData?.flat.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button disabled={newCategory.name.length < 2} onClick={addCategory}>
                  <Plus /> Ajouter
                </Button>
              </div>

              <div>
                {catData && catData.categories.length > 0 ? (
                  <CategoryBranch
                    nodes={catData.categories}
                    depth={0}
                    onReorder={reorder}
                    onDelete={deleteCategory}
                  />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune catégorie — créez la première ci-dessus.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attributes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-4 w-4" /> Dictionnaire d&apos;attributs
              </CardTitle>
              <CardDescription>Tailles, couleurs et matières réutilisables</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom</Label>
                  <Input
                    value={newAttribute.name}
                    onChange={(e) =>
                      setNewAttribute({ ...newAttribute, name: e.target.value })
                    }
                    placeholder="Ex : Taille vêtement"
                    className="w-[200px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={newAttribute.type}
                    onValueChange={(v) => setNewAttribute({ ...newAttribute, type: v })}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIZE">Taille</SelectItem>
                      <SelectItem value="COLOR">Couleur</SelectItem>
                      <SelectItem value="FABRIC">Matière</SelectItem>
                      <SelectItem value="OTHER">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valeurs (séparées par des virgules)</Label>
                  <Input
                    value={newAttribute.values}
                    onChange={(e) =>
                      setNewAttribute({ ...newAttribute, values: e.target.value })
                    }
                    placeholder="S, M, L, XL"
                    className="w-[260px]"
                  />
                </div>
                <Button disabled={newAttribute.name.length < 1} onClick={addAttribute}>
                  <Plus /> Ajouter Attribut
                </Button>
              </div>

              <div className="space-y-4">
                {attributes?.map((a) => (
                  <div key={a.id}>
                    <p className="mb-1 text-sm font-medium">
                      {a.name}{" "}
                      <span className="text-xs text-muted-foreground">({a.type})</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {a.values.map((v) => (
                        <button key={v.id} onClick={() => deleteValue(v.id)} title="Supprimer">
                          <Badge variant="secondary" className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    Aucun attribut défini.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
