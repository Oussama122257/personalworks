"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWilayas } from "@/hooks/useWilayas";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const { data: wilayas } = useWilayas();

  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState({ identifier: "", password: "" });
  const [reg, setReg] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "buyer",
    storeName: "",
    wilayaCode: "",
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      identifier: login.identifier,
      password: login.password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast.error("Identifiants invalides");
      return;
    }
    toast.success("Connexion réussie");
    // Hard navigation so the middleware routes to the right dashboard.
    window.location.href = callbackUrl;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reg,
          wilayaCode: reg.wilayaCode ? Number(reg.wilayaCode) : undefined,
          storeName: reg.storeName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'inscription");
        return;
      }
      toast.success("Compte créé ! Connexion…");
      const signRes = await signIn("credentials", {
        identifier: reg.email,
        password: reg.password,
        redirect: false,
      });
      if (!signRes?.error) window.location.href = "/";
      else router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-1 text-2xl font-extrabold">
            <Zap className="h-6 w-6 text-primary" /> Zeem<span className="text-primary">.</span>
          </CardTitle>
          <CardDescription>Marketplace algérienne — 58 wilayas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="register">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="identifier">Email ou téléphone</Label>
                  <Input
                    id="identifier"
                    required
                    value={login.identifier}
                    onChange={(e) => setLogin({ ...login, identifier: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={login.password}
                    onChange={(e) => setLogin({ ...login, password: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />} Se connecter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn("google", { callbackUrl })}
                >
                  Continuer avec Google
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Je suis</Label>
                  <Select
                    value={reg.role}
                    onValueChange={(v) => setReg({ ...reg, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">Acheteur</SelectItem>
                      <SelectItem value="seller">Vendeur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    id="fullName"
                    required
                    value={reg.fullName}
                    onChange={(e) => setReg({ ...reg, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={reg.email}
                    onChange={(e) => setReg({ ...reg, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    minLength={8}
                    value={reg.phone}
                    onChange={(e) => setReg({ ...reg, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="regPassword">Mot de passe (8+ caractères)</Label>
                  <Input
                    id="regPassword"
                    type="password"
                    required
                    minLength={8}
                    value={reg.password}
                    onChange={(e) => setReg({ ...reg, password: e.target.value })}
                  />
                </div>
                {reg.role === "seller" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="storeName">Nom de la boutique</Label>
                      <Input
                        id="storeName"
                        required
                        value={reg.storeName}
                        onChange={(e) => setReg({ ...reg, storeName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Wilaya de la boutique</Label>
                      <Select
                        value={reg.wilayaCode}
                        onValueChange={(v) => setReg({ ...reg, wilayaCode: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir une wilaya" />
                        </SelectTrigger>
                        <SelectContent>
                          {wilayas?.map((w) => (
                            <SelectItem key={w.code} value={String(w.code)}>
                              {w.code} — {w.nameFr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />} Créer mon compte
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              ← Retour à la boutique
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
