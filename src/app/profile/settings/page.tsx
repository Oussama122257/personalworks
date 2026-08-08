"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Trash2,
  Star,
  ShieldCheck,
  LogOut,
  KeyRound,
  Pencil,
} from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/header";
import {
  SettingsSection,
  Field,
  ToggleRow,
  UploadField,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { useWilayas } from "@/hooks/useWilayas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProfileDTO {
  fullName: string;
  email: string | null;
  phone: string;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

interface AddressDTO {
  id: string;
  label: string;
  fullName: string | null;
  phone: string | null;
  addressLine: string;
  isDefault: boolean;
  wilaya: { code: number; name: string };
  commune: { id: number; name: string };
}

interface PreferencesDTO {
  language: string;
  promoSms: boolean;
  promoEmail: boolean;
  autoApplyPoints: boolean;
  defaultOrderFilter: string;
  showCodBanner: boolean;
}

interface SecurityDTO {
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  loginHistory: {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    success: boolean;
    createdAt: string;
  }[];
}

const EMPTY_ADDRESS = {
  id: "",
  label: "Domicile",
  fullName: "",
  phone: "",
  wilayaCode: "",
  communeId: "",
  addressLine: "",
  isDefault: false,
};

function AddressDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: typeof EMPTY_ADDRESS;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: wilayas } = useWilayas();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const communes =
    wilayas?.find((w) => w.code === Number(form.wilayaCode))?.communes ?? [];

  async function save() {
    setBusy(true);
    try {
      const payload = {
        label: form.label,
        fullName: form.fullName || undefined,
        phone: form.phone || undefined,
        wilayaCode: Number(form.wilayaCode),
        communeId: Number(form.communeId),
        addressLine: form.addressLine,
        isDefault: form.isDefault,
      };
      const res = await fetch(
        form.id ? `/api/profile/addresses/${form.id}` : "/api/profile/addresses",
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'enregistrement");
        return;
      }
      toast.success(form.id ? "Adresse mise à jour" : "Adresse ajoutée");
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
          <DialogTitle>{form.id ? "Modifier l'adresse" : "Nouvelle adresse"}</DialogTitle>
          <DialogDescription>
            Les adresses enregistrées accélèrent le passage en caisse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Libellé">
              <Select value={form.label} onValueChange={(v) => setForm({ ...form, label: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Domicile">Domicile</SelectItem>
                  <SelectItem value="Travail">Travail</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Téléphone (optionnel)">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Nom du destinataire (optionnel)">
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Wilaya">
              <Select
                value={form.wilayaCode}
                onValueChange={(v) => setForm({ ...form, wilayaCode: v, communeId: "" })}
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
            <Field label="Commune">
              <Select
                value={form.communeId}
                onValueChange={(v) => setForm({ ...form, communeId: v })}
                disabled={!form.wilayaCode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {communes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Adresse complète">
            <Input
              value={form.addressLine}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              placeholder="Rue, quartier, repères…"
            />
          </Field>
          <ToggleRow
            label="Adresse par défaut"
            checked={form.isDefault}
            onChange={(v) => setForm({ ...form, isDefault: v })}
          />
          <Button
            className="w-full"
            disabled={busy || !form.wilayaCode || !form.communeId || form.addressLine.length < 5}
            onClick={save}
          >
            {busy && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PhoneChangeDialog({ current, onClose }: { current: string; onClose: () => void }) {
  const [phone, setPhone] = useState(current);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/profile/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step === "phone" ? { phone } : { phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      if (data.step === "code_sent") {
        setStep("code");
        toast.info(
          "Code envoyé par SMS. Sans fournisseur SMS configuré, il est écrit dans les logs du serveur."
        );
      } else {
        toast.success("Numéro vérifié et mis à jour");
        onClose();
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Changer de numéro</DialogTitle>
          <DialogDescription>
            Le téléphone sert d&apos;identifiant de connexion : un code de
            vérification est requis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nouveau numéro">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={step === "code"}
            />
          </Field>
          {step === "code" && (
            <Field label="Code à 6 chiffres">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                inputMode="numeric"
              />
            </Field>
          )}
          <Button className="w-full" disabled={busy} onClick={submit}>
            {busy && <Loader2 className="animate-spin" />}
            {step === "phone" ? "Envoyer le code" : "Vérifier"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecurityTab() {
  const queryClient = useQueryClient();
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [twoFa, setTwoFa] = useState<{ qr: string; secret: string } | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery<SecurityDTO>({
    queryKey: ["security"],
    queryFn: async () => {
      const res = await fetch("/api/profile/security");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  async function post(body: unknown) {
    setBusy(true);
    try {
      const res = await fetch("/api/profile/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Échec");
        return null;
      }
      return json;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Mot de passe"
        description="Changer le mot de passe déconnecte toutes vos sessions."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Mot de passe actuel">
            <Input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
            />
          </Field>
          <Field label="Nouveau mot de passe">
            <Input
              type="password"
              value={passwords.next}
              onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
            />
          </Field>
          <Field label="Confirmer">
            <Input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </Field>
        </div>
        <Button
          disabled={
            busy ||
            passwords.next.length < 8 ||
            passwords.next !== passwords.confirm ||
            !passwords.current
          }
          onClick={async () => {
            const out = await post({
              action: "change_password",
              currentPassword: passwords.current,
              newPassword: passwords.next,
            });
            if (out) {
              toast.success("Mot de passe modifié — reconnectez-vous");
              setTimeout(() => (window.location.href = "/login"), 1500);
            }
          }}
        >
          <KeyRound /> Modifier le mot de passe
        </Button>
        {passwords.next && passwords.next !== passwords.confirm && (
          <p className="text-xs text-destructive">Les mots de passe ne correspondent pas.</p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Authentification à deux facteurs"
        description="Protégez votre compte avec Google Authenticator ou une application TOTP équivalente."
      >
        {data?.twoFactorEnabled ? (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-green-600" /> 2FA activée
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const pwd = prompt("Confirmez votre mot de passe pour désactiver la 2FA");
                if (!pwd) return;
                const out = await post({ action: "2fa_disable", password: pwd });
                if (out) {
                  toast.success("2FA désactivée");
                  queryClient.invalidateQueries({ queryKey: ["security"] });
                }
              }}
            >
              Désactiver
            </Button>
          </div>
        ) : twoFa ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={twoFa.qr} alt="QR code 2FA" className="h-44 w-44 rounded border" />
            <p className="text-xs text-muted-foreground">
              Clé manuelle : <code className="font-mono">{twoFa.secret}</code>
            </p>
            <div className="flex items-end gap-2">
              <Field label="Code à 6 chiffres">
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  maxLength={6}
                  className="w-32"
                  inputMode="numeric"
                />
              </Field>
              <Button
                disabled={busy || token.length !== 6}
                onClick={async () => {
                  const out = await post({ action: "2fa_confirm", token });
                  if (out) {
                    toast.success("2FA activée");
                    setTwoFa(null);
                    setToken("");
                    queryClient.invalidateQueries({ queryKey: ["security"] });
                  }
                }}
              >
                Confirmer
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const out = await post({ action: "2fa_start" });
              if (out) setTwoFa({ qr: out.qrCodeDataUrl, secret: out.secret });
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Activer la 2FA
          </Button>
        )}
      </SettingsSection>

      <SettingsSection
        title="Sessions et historique de connexion"
        description="Les sessions utilisent des jetons JWT : il n'existe pas de liste de sessions actives côté serveur, mais vous pouvez toutes les révoquer d'un coup."
      >
        <Button
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            const out = await post({ action: "sign_out_everywhere" });
            if (out) {
              toast.success("Toutes les sessions ont été révoquées");
              setTimeout(() => (window.location.href = "/login"), 1500);
            }
          }}
        >
          <LogOut /> Se déconnecter partout
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Adresse IP</TableHead>
              <TableHead>Appareil</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.loginHistory.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">
                  {new Date(e.createdAt).toLocaleString("fr-DZ")}
                </TableCell>
                <TableCell className="font-mono text-xs">{e.ipAddress ?? "—"}</TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                  {e.userAgent ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={e.success ? "success" : "destructive"}>
                    {e.success ? "Réussie" : "Échouée"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {(!data || data.loginHistory.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Aucune connexion enregistrée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SettingsSection>
    </div>
  );
}

export default function BuyerSettingsPage() {
  const queryClient = useQueryClient();
  const [editingAddress, setEditingAddress] = useState<typeof EMPTY_ADDRESS | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);

  const { data: profileData, isError } = useQuery<{ profile: ProfileDTO }>({
    queryKey: ["profile-settings"],
    queryFn: async () => {
      const res = await fetch("/api/profile/settings");
      if (!res.ok) throw new Error("unauthenticated");
      return res.json();
    },
    retry: false,
  });

  const { data: addresses } = useQuery<AddressDTO[]>({
    queryKey: ["addresses"],
    queryFn: async () => {
      const res = await fetch("/api/profile/addresses");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data.addresses;
    },
  });

  const { data: prefsData } = useQuery<{ preferences: PreferencesDTO }>({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res = await fetch("/api/preferences");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const personal = useSettingsForm(profileData?.profile, "/api/profile/settings", (v) => ({
    fullName: v.fullName,
    email: v.email,
    dateOfBirth: v.dateOfBirth,
    avatarUrl: v.avatarUrl,
  }));
  const prefs = useSettingsForm(prefsData?.preferences, "/api/preferences");

  if (isError) {
    return (
      <>
        <StorefrontHeader />
        <main className="container py-20 text-center">
          <h1 className="text-xl font-bold">Connectez-vous pour accéder à vos paramètres</h1>
          <Link href="/login" className="mt-2 inline-block text-primary underline">
            Aller à la connexion
          </Link>
        </main>
      </>
    );
  }

  const p = personal.values;
  const pr = prefs.values;

  return (
    <>
      <StorefrontHeader />
      <main className="container space-y-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mes paramètres</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/profile">← Mon profil</Link>
          </Button>
        </div>

        <Tabs defaultValue="personal">
          <TabsList className="flex-wrap">
            <TabsTrigger value="personal">Informations</TabsTrigger>
            <TabsTrigger value="addresses">Adresses</TabsTrigger>
            <TabsTrigger value="comms">Communication</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            {p && (
              <SettingsSection
                title="Informations personnelles"
                footer={<SaveButton onSave={personal.save} dirty={personal.dirty} />}
              >
                <Field label="Nom complet">
                  <Input
                    value={p.fullName}
                    onChange={(e) => personal.set("fullName", e.target.value)}
                  />
                </Field>
                <Field label="Téléphone" hint="Identifiant de connexion — vérification par code requise.">
                  <div className="flex gap-2">
                    <Input value={p.phone} readOnly className="bg-muted" />
                    <Button variant="outline" onClick={() => setPhoneOpen(true)}>
                      <Pencil /> Changer
                    </Button>
                  </div>
                </Field>
                <Field label="Email" hint="Optionnel — utilisé pour les emails marketing.">
                  <Input
                    type="email"
                    value={p.email ?? ""}
                    onChange={(e) => personal.set("email", e.target.value || null)}
                  />
                </Field>
                <Field label="Date de naissance" hint="Sert au bonus de points d'anniversaire.">
                  <Input
                    type="date"
                    value={p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : ""}
                    onChange={(e) =>
                      personal.set(
                        "dateOfBirth",
                        e.target.value ? new Date(e.target.value).toISOString() : null
                      )
                    }
                  />
                </Field>
                <UploadField
                  label="Photo de profil"
                  value={p.avatarUrl}
                  onChange={(v) => personal.set("avatarUrl", v)}
                />
              </SettingsSection>
            )}
          </TabsContent>

          <TabsContent value="addresses">
            <SettingsSection
              title="Carnet d'adresses"
              description="L'adresse par défaut est pré-remplie au moment de commander."
              footer={
                <Button
                  variant="outline"
                  onClick={() => setEditingAddress({ ...EMPTY_ADDRESS })}
                >
                  <Plus /> Ajouter une adresse
                </Button>
              }
            >
              <div className="space-y-2">
                {addresses?.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {a.label}
                        {a.isDefault && (
                          <Badge variant="secondary">
                            <Star className="mr-1 h-3 w-3" /> Par défaut
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {a.addressLine}, {a.commune.name}, {a.wilaya.name}
                      </p>
                      {(a.fullName || a.phone) && (
                        <p className="text-xs text-muted-foreground">
                          {[a.fullName, a.phone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!a.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await fetch(`/api/profile/addresses/${a.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isDefault: true }),
                            });
                            toast.success("Adresse par défaut mise à jour");
                            queryClient.invalidateQueries({ queryKey: ["addresses"] });
                          }}
                        >
                          Définir par défaut
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setEditingAddress({
                            id: a.id,
                            label: a.label,
                            fullName: a.fullName ?? "",
                            phone: a.phone ?? "",
                            wilayaCode: String(a.wilaya.code),
                            communeId: String(a.commune.id),
                            addressLine: a.addressLine,
                            isDefault: a.isDefault,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Supprimer cette adresse ?")) return;
                          await fetch(`/api/profile/addresses/${a.id}`, { method: "DELETE" });
                          toast.success("Adresse supprimée");
                          queryClient.invalidateQueries({ queryKey: ["addresses"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!addresses || addresses.length === 0) && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune adresse enregistrée.
                  </p>
                )}
              </div>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="comms">
            {pr && (
              <SettingsSection
                title="Communication et affichage"
                footer={<SaveButton onSave={prefs.save} dirty={prefs.dirty} />}
              >
                <ToggleRow
                  label="SMS promotionnels"
                  description="Offres et nouveautés par SMS."
                  checked={pr.promoSms}
                  onChange={(v) => prefs.set("promoSms", v)}
                />
                <ToggleRow
                  label="Emails promotionnels"
                  description="Offres et nouveautés par email."
                  checked={pr.promoEmail}
                  onChange={(v) => prefs.set("promoEmail", v)}
                />
                <ToggleRow
                  label="Utiliser mes points automatiquement"
                  description="Applique la réduction disponible au moment de commander."
                  checked={pr.autoApplyPoints}
                  onChange={(v) => prefs.set("autoApplyPoints", v)}
                />
                <ToggleRow
                  label="Bannière « préparez l'appoint »"
                  description="Rappel du montant à préparer sur la page de suivi."
                  checked={pr.showCodBanner}
                  onChange={(v) => prefs.set("showCodBanner", v)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Langue">
                    <Select
                      value={pr.language}
                      onValueChange={(v) => prefs.set("language", v)}
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
                  <Field label="Filtre de commandes par défaut">
                    <Select
                      value={pr.defaultOrderFilter}
                      onValueChange={(v) => prefs.set("defaultOrderFilter", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Toutes</SelectItem>
                        <SelectItem value="PENDING">En attente</SelectItem>
                        <SelectItem value="DELIVERED">Livrées</SelectItem>
                        <SelectItem value="CANCELLED">Annulées</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </SettingsSection>
            )}
          </TabsContent>

          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
        </Tabs>
      </main>

      {editingAddress && (
        <AddressDialog
          initial={editingAddress}
          onClose={() => setEditingAddress(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["addresses"] })}
        />
      )}
      {phoneOpen && p && (
        <PhoneChangeDialog current={p.phone} onClose={() => setPhoneOpen(false)} />
      )}
    </>
  );
}
