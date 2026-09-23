import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from "lucide-react";
import type { SkyKind } from "@/lib/weather/codes";

export function SkyIcon({ kind, className = "size-5" }: { kind: SkyKind; className?: string }) {
  const props = { className, "aria-hidden": true as const };
  if (kind === "clear") return <Sun {...props} />;
  if (kind === "partly") return <CloudSun {...props} />;
  if (kind === "fog") return <CloudFog {...props} />;
  if (kind === "drizzle" || kind === "rain") return <CloudRain {...props} />;
  if (kind === "snow") return <Snowflake {...props} />;
  if (kind === "thunder") return <CloudLightning {...props} />;
  return <Cloud {...props} />;
}
