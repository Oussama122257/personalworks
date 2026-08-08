import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zeem Marketplace — Le marché algérien en ligne",
  description:
    "Achetez auprès de vendeurs locaux dans les 58 wilayas d'Algérie. Paiement à la livraison, suivi en temps réel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
