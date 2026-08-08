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
  Star,
  Sparkles,
  Printer,
  PackageCheck,
  PlugZap,
} from "lucide-react";
import { useSellerProducts, variantLabel, type ProductDTO } from "@/hooks/useProducts";
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
  isActive: boolean;
  approvedBy?: string | null;
  rejectionReason?: string | null;
  balance: number;
  commissionRate: number;
  rib?: string | null;
  deliveryProviderType: string;
  customApiKeyMasked?: string | null;
  hasCustomCredentials?: boolean;
  wilaya: { code: number; name: string };
}

interface SellerStats {
  revenue30d: number;
  orders30d: number;
  rating: number | null;
  reviewCount: number;
  criticalStockCount: number;
  criticalStock: {
    variantId: string;
    sku: string;
    product: string;
    variant: string;
    stock: number;
    outOfStock: boolean;
  }[];
}

interface BalanceDTO {
  balance: number;
  pendingPayout: number;
  pendingCount: number;
  paidPayout: number;
  commissionsWithheld: number;
  transactions: {
    id: string;
    type: string;
    status: string;
    amount: number;
    reference: string;
    createdAt: string;
  }[];
}

interface VariantForm {
  id?: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  stockQuantity: string;
  lowStockThreshold: string;
}

const EMPTY_VARIANT: VariantForm = {
  sku: "",
  size: "",
  color: "",
  price: "",
  stockQuantity: "0",
  lowStockThreshold: "5",
};

const CATEGORIES = ["Mode", "Électronique", "Maison", "Beauté", "Sport", "General"];

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
  const [aiBusy, setAiBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "General",
    images: product?.images ?? [],
    variants: (product?.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.attributes?.size ?? "",
      color: v.attributes?.color ?? "",
      price: String(v.price),
      stockQuantity: String(v.stockQuantity),
      lowStockThreshold: String(v.lowStockThreshold),
    })) ?? [{ ...EMPTY_VARIANT }]) as VariantForm[],
  }));

  async function generateDescription() {
    if (!form.name) {
      toast.error("Renseignez d'abord le nom du produit");
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch("/api/seller/ai-describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, category: form.category }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de la génération");
        return;
      }
      setForm((f) => ({ ...f, description: `${data.fr}\n\n${data.ar}` }));
      toast.success(
        data.generated
          ? "Description générée par IA"
          : "Modèle de description inséré (OPENAI_API_KEY non configurée)"
      );
    } finally {
      setAiBusy(false);
    }
  }

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
        images: form.images,
        variants: form.variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          // Blank SKU → the server generates {StoreSlug}-{Cat}-{Size}-{Color}
          ...(v.sku.trim() ? { sku: v.sku.trim() } : {}),
          size: v.size || undefined,
          color: v.color || undefined,
          price: Number(v.price),
          stockQuantity: Number(v.stockQuantity),
          lowStockThreshold: Number(v.lowStockThreshold),
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {product ? "Modifier le produit" : "Nouveau produit"} — étape {step}/3
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Informations générales"
              : step === 2
                ? "Variantes — laissez le SKU vide pour le générer automatiquement"
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
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiBusy}
                  onClick={generateDescription}
                >
                  {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Générer (FR + AR)
                </Button>
              </div>
              <Textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
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
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {form.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-7 items-end gap-2 rounded-lg border p-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">SKU (auto si vide)</Label>
                  <Input
                    value={v.sku}
                    placeholder="auto"
                    onChange={(e) => {
                      const variants = [...form.variants];
                      variants[i] = { ...v, sku: e.target.value };
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
                <div className="flex items-end gap-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Seuil</Label>
                    <Input
                      type="number"
                      value={v.lowStockThreshold}
                      onChange={(e) => {
                        const variants = [...form.variants];
                        variants[i] = { ...v, lowStockThreshold: e.target.value };
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
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            Précédent
          </Button>
          {step < 3 ? (
            <Button
              disabled={
                (step === 1 && !form.name) ||
                (step === 2 && form.variants.some((v) => !v.price))
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
  const [testing, setTesting] = useState(false);

  const { data: store } = useQuery<StoreDTO>({
    queryKey: ["seller-store"],
    queryFn: async () => {
      const res = await fetch("/api/seller/store");
      if (!res.ok) throw new Error("Failed to load store");
      const data = await res.json();
      return data.store;
    },
  });

  const { data: stats } = useQuery<SellerStats>({
    queryKey: ["seller-stats"],
    queryFn: async () => {
      const res = await fetch("/api/seller/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    enabled: Boolean(store?.isActive),
  });

  const { data: balance } = useQuery<BalanceDTO>({
    queryKey: ["seller-balance"],
    queryFn: async () => {
      const res = await fetch("/api/seller/balance");
      if (!res.ok) throw new Error("Failed to load balance");
      return res.json();
    },
    enabled: Boolean(store?.isActive),
  });

  const { data: products, refetch: refetchProducts } = useSellerProducts();
  const { data: orders } = useOrders();

  useRealtime(store ? `store-${store.id}` : null, "order:new", () => {
    toast.info("Nouvelle commande pour votre boutique 🎉");
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
  });

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

  async function updateStore(patch: Record<string, unknown>) {
    const res = await fetch("/api/seller/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      toast.success("Paramètres mis à jour");
      queryClient.invalidateQueries({ queryKey: ["seller-store"] });
    } else {
      toast.error("Échec de la mise à jour");
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/seller/test-connection", { method: "POST" });
      const data = await res.json();
      if (data.online) {
        toast.success(`Connexion réussie (${data.latencyMs} ms)`);
      } else if (!data.configured) {
        toast.warning(data.error ?? "Transporteur non configuré côté serveur");
      } else {
        toast.error(`Échec : ${data.error ?? "connexion impossible"}`);
      }
    } finally {
      setTesting(false);
    }
  }

  async function prepareShipment(shipmentId: string) {
    const res = await fetch(`/api/seller/shipments/${shipmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Échec");
      return;
    }
    toast.success("Colis marqué comme prêt");
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  if (store && !store.isActive) {
    return (
      <div className="container py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 text-xl font-bold">
          {store.rejectionReason
            ? "Demande refusée"
            : "Boutique en attente d'approbation"}
        </h1>
        <p className="mx-auto mt-1 max-w-md text-muted-foreground">
          {store.rejectionReason
            ? `Votre boutique « ${store.name} » a été refusée. Motif : ${store.rejectionReason}`
            : `Votre boutique « ${store.name} » doit être validée par le manager de la wilaya ${store.wilaya.name} avant de pouvoir vendre.`}
        </p>
      </div>
    );
  }

  const pendingShipments =
    orders?.flatMap((o) =>
      o.shipments
        .filter((s) => s.status === "PENDING_PICKUP")
        .map((s) => ({ order: o, shipment: s }))
    ) ?? [];

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
          <Plus /> Ajouter Produit
        </Button>
      </div>

      {/* Inventory alert bar */}
      {stats && stats.criticalStockCount > 0 && (
        <div className="rounded-lg border border-amber-500/60 bg-amber-50 p-4 text-sm dark:bg-amber-950/20">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            ⚠️ Attention : {stats.criticalStockCount} produit
            {stats.criticalStockCount > 1 ? "s sont" : " est"} en stock critique
          </p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            {stats.criticalStock
              .slice(0, 4)
              .map((c) => `${c.product} ${c.variant}, SKU: ${c.sku} (${c.stock})`)
              .join(" · ")}
            {stats.criticalStock.length > 4 && ` … +${stats.criticalStock.length - 4}`}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Revenus (30j)"
          value={stats ? formatDZD(stats.revenue30d) : "…"}
          hint={store ? `Commission ${store.commissionRate}%` : undefined}
          icon={Wallet}
        />
        <StatCard title="Commandes (30j)" value={stats?.orders30d ?? "…"} icon={ShoppingBag} />
        <StatCard
          title="Avis"
          value={stats?.rating ? `${stats.rating} ⭐` : "—"}
          hint={stats ? `${stats.reviewCount} avis` : undefined}
          icon={Star}
        />
        <StatCard
          title="Stock Critique"
          value={stats?.criticalStockCount ?? "…"}
          hint="Sous le seuil d'alerte"
          icon={AlertTriangle}
        />
      </div>

      <Tabs defaultValue="fulfillment">
        <TabsList>
          <TabsTrigger value="fulfillment">Commandes à préparer</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="finance">Finances</TabsTrigger>
          <TabsTrigger value="shipping">Livraison</TabsTrigger>
        </TabsList>

        <TabsContent value="fulfillment">
          <Card>
            <CardHeader>
              <CardTitle>Colis en attente de ramassage</CardTitle>
              <CardDescription>
                Imprimez le ticket puis marquez le colis comme préparé.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Articles</TableHead>
                    <TableHead>COD</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingShipments.map(({ order, shipment }) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-mono text-xs">{order.reference}</TableCell>
                      <TableCell>
                        {order.buyer?.fullName ?? order.guestName ?? "—"}
                        <span className="block text-xs text-muted-foreground">
                          {order.address}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {order.items
                          .map((i) => `${i.variant.product.name} × ${i.quantity}`)
                          .join(", ")}
                      </TableCell>
                      <TableCell>{formatDZD(shipment.codAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => window.print()}
                        >
                          <Printer /> Imprimer Ticket
                        </Button>
                        <Button size="sm" onClick={() => prepareShipment(shipment.id)}>
                          <PackageCheck /> Préparer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingShipments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun colis en attente 🎉
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products?.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stockQuantity, 0);
              const price = Math.min(...p.variants.map((v) => v.price));
              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="flex aspect-video items-center justify-center bg-muted">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="space-y-1 p-3">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-sm text-primary">{formatDZD(price)}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock : {stock} · {p.variants.length} variante(s)
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant={p.isPublished ? "success" : "secondary"}>
                        {p.isPublished ? "Publié" : "Brouillon"}
                      </Badge>
                      <div>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProduct(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {(!products || products.length === 0) && (
              <p className="col-span-full py-10 text-center text-muted-foreground">
                Aucun produit — ajoutez votre premier produit !
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="finance">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Solde disponible</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold text-primary">
                  {balance ? formatDZD(balance.balance) : "…"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {balance
                    ? `${formatDZD(balance.pendingPayout)} en attente (${balance.pendingCount} virement(s))`
                    : ""}
                </p>
                <div className="mt-4 space-y-1.5">
                  <Label className="text-xs">RIB pour les virements</Label>
                  <div className="flex gap-2">
                    <Input id="rib" defaultValue={store?.rib ?? ""} placeholder="007…" />
                    <Button
                      size="sm"
                      onClick={() =>
                        updateStore({
                          rib: (document.getElementById("rib") as HTMLInputElement).value,
                        })
                      }
                    >
                      Sauver
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Dernières transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balance?.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{t.type}</TableCell>
                        <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "PAID" ? "success" : "secondary"}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatDZD(t.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {(!balance || balance.transactions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Aucune transaction
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres de livraison</CardTitle>
              <CardDescription>
                Flotte Zeem par défaut, ou vos propres identifiants transporteur
                (chiffrés avant stockage).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Transporteur</Label>
                <Select
                  value={store?.deliveryProviderType ?? "ZEEM_DEFAULT"}
                  onValueChange={(v) => updateStore({ deliveryProviderType: v })}
                >
                  <SelectTrigger className="max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZEEM_DEFAULT">Zeem (par défaut)</SelectItem>
                    <SelectItem value="YALIDINE">Yalidine</SelectItem>
                    <SelectItem value="ZR_EXPRESS">ZR Express</SelectItem>
                    <SelectItem value="POSTE">Algérie Poste</SelectItem>
                    <SelectItem value="CUSTOM">Personnalisé (clés API)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {store && store.deliveryProviderType !== "ZEEM_DEFAULT" && (
                <div className="max-w-md space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Identifiants transporteur</p>
                  {store.hasCustomCredentials && (
                    <p className="text-xs text-muted-foreground">
                      Clé enregistrée : {store.customApiKeyMasked} (chiffrée)
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Clé API</Label>
                    <Input id="api-key" type="password" placeholder="••••" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Secret API</Label>
                    <Input id="api-secret" type="password" placeholder="••••" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Numéro de compte</Label>
                    <Input id="api-account" defaultValue={""} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        updateStore({
                          customApiKey: (document.getElementById("api-key") as HTMLInputElement)
                            .value,
                          customApiSecret: (
                            document.getElementById("api-secret") as HTMLInputElement
                          ).value,
                          customAccountNumber: (
                            document.getElementById("api-account") as HTMLInputElement
                          ).value,
                        })
                      }
                    >
                      Enregistrer les clés
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testing}
                      onClick={testConnection}
                    >
                      {testing ? <Loader2 className="animate-spin" /> : <PlugZap />}
                      Test Connection
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
          onSaved={() => {
            refetchProducts();
            queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
          }}
        />
      )}
    </div>
  );
}
