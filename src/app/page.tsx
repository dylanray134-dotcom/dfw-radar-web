import { Suspense } from "react";
import { RadarApp } from "@/components/radar-app";

export default function Page() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#071018]" />}>
      <RadarApp />
    </Suspense>
  );
}
