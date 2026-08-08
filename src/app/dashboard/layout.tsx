import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap, LogOut, Store, Settings } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrateur",
  SELLER: "Vendeur",
  WILAYA_MANAGER: "Manager de wilaya",
  ACCOUNTANT: "Comptable",
  AGENT: "Livreur",
  ERP_MANAGER: "Manager ERP",
  LOGISTICS_MANAGER: "Manager logistique",
  SUPPORT: "Support client",
  BUYER: "Acheteur",
};

const SETTINGS_HREF: Record<string, string> = {
  ADMIN: "/dashboard/admin/settings",
  SELLER: "/dashboard/seller/settings",
  WILAYA_MANAGER: "/dashboard/manager/settings",
  ACCOUNTANT: "/dashboard/accountant/settings",
  AGENT: "/dashboard/agent/settings",
  ERP_MANAGER: "/dashboard/erp/settings",
  LOGISTICS_MANAGER: "/dashboard/logistics/settings",
  SUPPORT: "/dashboard/support/settings",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const settingsHref = SETTINGS_HREF[session.user.role] ?? null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-14 items-center gap-3">
          <Link href="/" className="flex items-center gap-1 font-extrabold">
            <Zap className="h-5 w-5 text-primary" />
            Zeem<span className="text-primary">.</span>
          </Link>
          <Badge variant="secondary">{ROLE_LABEL[session.user.role] ?? session.user.role}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.name ?? session.user.email}
            </span>
            {settingsHref && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={settingsHref}>
                  <Settings /> Réglages
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Store /> Boutique
              </Link>
            </Button>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                <LogOut /> Déconnexion
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
