import Link from "next/link";
import { Wrench } from "lucide-react";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const { platformName, maintenanceMode } = await getSettings("general");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <Wrench className="h-12 w-12 text-primary" />
      <h1 className="mt-4 text-2xl font-bold">
        {platformName} est en maintenance
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Nous effectuons une opération de maintenance. Le service sera rétabli très
        prochainement — merci de votre patience.
      </p>
      {!maintenanceMode && (
        <Link href="/" className="mt-4 text-primary underline">
          La maintenance est terminée — retourner à la boutique
        </Link>
      )}
    </main>
  );
}
