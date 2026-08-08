import { Storefront } from "@/components/storefront/product-grid";
import { assertNotInMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await assertNotInMaintenance();
  return <Storefront />;
}
