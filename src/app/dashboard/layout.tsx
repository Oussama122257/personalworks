import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap, LogOut, Store } from "lucide-react";
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
  BUYER: "Acheteur",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

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
