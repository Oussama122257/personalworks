"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
  Package,
  Wallet,
  ShoppingBag,
  Upload,
  Loader2,
} from "lucide-react";
import { useSellerProducts, type ProductDTO } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useRealtime } from "@/hooks/useRealtime";
import { formatDZD } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StoreDTO {
  id: string;
  name: string;
  slug: string;
  status: string;
  balance: number;
  commissionRate: number;
  logoUrl?: string | null;
  shippingProvider: string;
  shippingApiKey?: string | null;
  wilaya: { code: number; nameFr: string };
}

interface VariantForm {
  id?: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  price: string;
  stockQuantity: string;
}

const EMPTY_VARIANT: VariantForm = {
  sku: "",
  name: "",
  size: "",
  color: "",
  price: "",
  stockQuantity: "0",
};

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: ProductDTO | null;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(() => ({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "General",
    basePrice: product ? String(product.basePrice) : "",
    lowStockThreshold: product ? String(product.lowStockThreshold) : "5",
    images: product?.images ?? [],
    variants: (product?.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      size: v.size ?? "",
      color: v.color ?? "",
      price: String(v.price),
      stockQuantity: String(v.stockQuantity),
    })) ?? [{ ...EMPTY_VARIANT }]) as VariantForm[],
  }));

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'upload");
        return;
      }
      setForm((f) => ({ ...f, images: [...f.images, data.url] }));
      toast.success("Image ajoutée");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        basePrice: Number(form.basePrice),
        lowStockThreshold: Number(form.lowStockThreshold),
        images: form.images,
        variants: form.variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          sku: v.sku,
          name: v.name || v.sku,
          size: v.size || undefined,
          color: v.color || undefined,
          price: Number(v.price),
          stockQuantity: Number(v.stockQuantity),
        })),
      };
      const res = await fetch(
        product ? `/api/seller/products/${product.id}` : "/api/seller/products",
        {
          method: product ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'enregistrement");
        return;
      }
      toast.success(product ? "Produit mis à jour" : "Produit créé");
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {product ? "Modifier le produit" : "Nouveau produit"} — étape {step}/3
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Informations générales"
              : step === 2
                ? "Variantes (SKU, prix, stock)"
                : "Images du produit"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Mode", "Électronique", "Maison", "Beauté", "Sport", "General"].map(
                      (c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prix de base</Label>
                <Input
                  type="number"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Seuil stock bas</Label>
                <Input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {form.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-6 items-end gap-2 rounded-lg border p-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">SKU</Label>
                  <Input
                    value={v.sku}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, sku: e.target.value, name: v.name || e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Taille</Label>
                  <Input
                    value={v.size}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, size: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Couleur</Label>
                  <Input
                    value={v.color}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, color: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prix</Label>
                  <Input
                    type="number"
                    value={v.price}
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, price: e.target.value };
                      setForm({ ...form, variants });
                    }}
                  />
                </div>
                <div className="flex items-end gap-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Stock</Label>
                    <Input
                      type="number"
                      value={v.stockQuantity}
                      onChange={(e) => {
                        const variants = [...form.variants];
                        variants[i] = { ...v, stockQuantity: e.target.value };
                        setForm({ ...form, variants });
                      }}
                    />
                  </div>
                  {form.variants.length > 1 && !v.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setForm({
                          ...form,
                          variants: form.variants.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setForm({ ...form, variants: [...form.variants, { ...EMPTY_VARIANT }] })
              }
            >
              <Plus /> Ajouter une variante
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {form.images.map((img) => (
                <div key={img} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-20 w-20 rounded-md object-cover" />
                  <button
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white"
                    onClick={() =>
                      setForm({ ...form, images: form.images.filter((i) => i !== img) })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <Label
              htmlFor="image-upload"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-accent"
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              Cliquez pour téléverser une image (JPEG/PNG/WebP, 5 Mo max)
            </Label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => s - 1)}
          >
            Précédent
          </Button>
          {step < 3 ? (
            <Button
              disabled={
                (step === 1 && (!form.name || !form.basePrice)) ||
                (step === 2 && form.variants.some((v) => !v.sku || !v.price))
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Suivant
            </Button>
          ) : (
            <Button disabled={busy} onClick={save}>
              {busy && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SellerDashboard() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | null>(null);

  const { data: store } = useQuery<StoreDTO>({
    queryKey: ["seller-store"],
    queryFn: async () => {
      const res = await fetch("/api/seller/store");
      if (!res.ok) throw new Error("Failed to load store");
      const data = await res.json();
      return data.store;
    },
  });

  const { data: products, refetch: refetchProducts } = useSellerProducts();
  const { data: orders } = useOrders();

  // Live: new orders for this store.
  useRealtime(store ? `store-${store.id}` : null, "order:new", () => {
    toast.info("Nouvelle commande pour votre boutique 🎉");
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  });

  const lowStock =
    products?.flatMap((p) =>
      p.variants
        .filter((v) => v.stockQuantity < p.lowStockThreshold)
        .map((v) => ({ product: p.name, variant: v.name, stock: v.stockQuantity }))
    ) ?? [];

  async function deleteProduct(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const res = await fetch(`/api/seller/products/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Échec de la suppression");
      return;
    }
    toast.success(data.archived ? "Produit archivé (commandes existantes)" : "Produit supprimé");
    refetchProducts();
  }

  async function updateShipping(provider: string, apiKey?: string) {
    const res = await fetch("/api/seller/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingProvider: provider,
        shippingApiKey: provider === "CUSTOM" ? (apiKey ?? "") : null,
      }),
    });
    if (res.ok) {
      toast.success("Paramètres de livraison mis à jour");
      queryClient.invalidateQueries({ queryKey: ["seller-store"] });
    } else {
      toast.error("Échec de la mise à jour");
    }
  }

  if (store && store.status !== "ACTIVE") {
    return (
      <div className="container py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 text-xl font-bold">Boutique en attente d&apos;approbation</h1>
        <p className="mt-1 text-muted-foreground">
          Votre boutique « {store.name} » ({store.status}) doit être validée par le
          manager de votre wilaya avant de pouvoir vendre.
        </p>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{store?.name ?? "Ma boutique"}</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus /> Ajouter un produit
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Solde disponible"
          value={store ? formatDZD(store.balance) : "…"}
          hint={store ? `Commission plateforme : ${store.commissionRate}%` : undefined}
          icon={Wallet}
        />
        <StatCard title="Produits" value={products?.length ?? "…"} icon={Package} />
        <StatCard title="Commandes" value={orders?.length ?? "…"} icon={ShoppingBag} />
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Alertes de stock ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {lowStock.map((l, i) => (
              <p key={i}>
                {l.product} — {l.variant} :{" "}
                <span className="font-semibold">{l.stock} restant(s)</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="orders">Commandes</TabsTrigger>
          <TabsTrigger value="shipping">Livraison</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Variantes</TableHead>
                    <TableHead>Stock total</TableHead>
                    <TableHead>Publié</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.variants.length}</TableCell>
                      <TableCell>
                        {p.variants.reduce((s, v) => s + v.stockQuantity, 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.isPublished ? "success" : "secondary"}>
                          {p.isPublished ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!products || products.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Aucun produit — ajoutez votre premier produit !
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders?.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                      <TableCell>
                        {o.guestName}
                        <span className="block text-xs text-muted-foreground">{o.phone}</span>
                      </TableCell>
                      <TableCell>
                        {o.variant.product.name} × {o.quantity}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.commune.name}, {o.wilaya.nameFr}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{o.shipment?.status ?? o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatDZD(o.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {(!orders || orders.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Aucune commande pour le moment
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres de livraison</CardTitle>
              <CardDescription>
                Utilisez la flotte Zeem par défaut ou vos propres clés API transporteur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Transporteur</Label>
                <Select
                  value={store?.shippingProvider ?? "ZEEM_DEFAULT"}
                  onValueChange={(v) => updateShipping(v, store?.shippingApiKey ?? undefined)}
                >
                  <SelectTrigger className="max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZEEM_DEFAULT">Zeem (par défaut)</SelectItem>
                    <SelectItem value="YALIDINE">Yalidine</SelectItem>
                    <SelectItem value="ZR_EXPRESS">ZR Express</SelectItem>
                    <SelectItem value="POSTE">Algérie Poste</SelectItem>
                    <SelectItem value="CUSTOM">Personnalisé (clé API)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {store?.shippingProvider === "CUSTOM" && (
                <div className="space-y-1.5">
                  <Label>Clé API transporteur</Label>
                  <div className="flex max-w-sm gap-2">
                    <Input
                      id="api-key"
                      defaultValue={store.shippingApiKey ?? ""}
                      placeholder="sk_…"
                    />
                    <Button
                      onClick={() =>
                        updateShipping(
                          "CUSTOM",
                          (document.getElementById("api-key") as HTMLInputElement).value
                        )
                      }
                    >
                      Sauver
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {formOpen && (
        <ProductFormDialog
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          product={editing}
          onSaved={() => refetchProducts()}
        />
      )}
    </div>
  );
}
