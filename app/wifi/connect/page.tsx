import { getWifiSuggestion } from "@/app/wifi/actions";
import { WifiConnect } from "@/components/wifi/wifi-connect";

export const dynamic = "force-dynamic";

export default async function WifiConnectPage() {
  const suggestion = await getWifiSuggestion();
  return <WifiConnect suggestion={suggestion} />;
}
