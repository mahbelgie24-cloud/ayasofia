import { isFeatureEnabled, FEATURE_WIFI_PORTAL } from "@/lib/features";
import { FeatureOff } from "@/components/digital-menu/feature-off";
import { WifiSplash } from "@/components/wifi/wifi-splash";
import { getSplashSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function WifiSplashPage() {
  const active = await isFeatureEnabled(FEATURE_WIFI_PORTAL);
  if (!active) return <FeatureOff />;
  // P1-M6: admin-editable splash copy — read from settings so a change in the
  // admin screen is reflected on the guest-facing splash.
  const copy = await getSplashSettings();
  return <WifiSplash title={copy.title} subtitle={copy.subtitle} privacyLine={copy.privacyLine} />;
}
