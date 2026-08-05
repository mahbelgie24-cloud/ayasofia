import { isFeatureEnabled, FEATURE_WIFI_PORTAL } from "@/lib/features";
import { FeatureOff } from "@/components/digital-menu/feature-off";
import { WifiSplash } from "@/components/wifi/wifi-splash";

export const dynamic = "force-dynamic";

export default async function WifiSplashPage() {
  const active = await isFeatureEnabled(FEATURE_WIFI_PORTAL);
  if (!active) return <FeatureOff />;
  return <WifiSplash />;
}
