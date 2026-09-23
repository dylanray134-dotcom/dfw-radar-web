"use client";

import { Button } from "@/components/ui/button";
import { LocateFixed } from "lucide-react";

type Props = {
  onAllow: () => void;
  onDismiss: () => void;
  compact?: boolean;
};

export function LocationPrompt({ onAllow, onDismiss, compact = false }: Props) {
  return (
    <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-4"}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <LocateFixed className="size-4" />
        </span>
        <div>
          <p className="text-base font-medium">Weather for where you are</p>
          <p className="mt-1 text-sm text-muted-foreground">
            DFW Radar uses your location to name the city and load a free forecast. The radar loop keeps
            running if you skip this.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onAllow}>
          Allow location
        </Button>
        <Button type="button" variant="secondary" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
