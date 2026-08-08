import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { ThemeInjector } from "@/components/theme-injector";
import { getSettings } from "@/lib/settings";
import "./globals.css";

/** Title, description and favicon follow the admin's branding settings. */
export async function generateMetadata(): Promise<Metadata> {
  const [general, theme] = await Promise.all([
    getSettings("general"),
    getSettings("theme"),
  ]);
  return {
    title: `${general.platformName} Marketplace — Le marché algérien en ligne`,
    description: `Achetez auprès de vendeurs locaux dans les 58 wilayas d'Algérie. Paiement à la livraison, suivi en temps réel.`,
    ...(theme.favicon ? { icons: { icon: theme.favicon } } : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <ThemeInjector />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
