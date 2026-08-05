import { getDigitalMenuData } from "@/app/digital-menu/actions";
import { MenuShell } from "@/components/digital-menu/menu-shell";
import { isFeatureEnabled, FEATURE_DIGITAL_MENU } from "@/lib/features";
import { FeatureOff } from "@/components/digital-menu/feature-off";

export const dynamic = "force-dynamic";

export default async function MenuHomePage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = await params;
  const active = await isFeatureEnabled(FEATURE_DIGITAL_MENU);
  if (!active) return <FeatureOff />;

  const result = await getDigitalMenuData(branchSlug);
  if (!result.success) {
    return <FeatureOff message={result.error} />;
  }

  return (
    <MenuShell
      branchName={result.data.branch.name}
      branchSlug={branchSlug}
      categories={result.data.categories}
      todaySuggestion={result.data.todaySuggestion}
      bestSellers={result.data.bestSellers}
      table={result.table}
    />
  );
}
