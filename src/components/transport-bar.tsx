"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw, SkipBack, SkipForward } from "lucide-react";

const SPEEDS = [
  { ms: 120, label: "Fast" },
  { ms: 250, label: "1×" },
  { ms: 500, label: "Slow" },
];

type Props = {
  frameIndex: number;
  frameCount: number;
  playing: boolean;
  dwellMs: number;
  stamp: string;
  refreshing: boolean;
  onFrame: (index: number) => void;
  onTogglePlay: () => void;
  onDwell: (ms: number) => void;
  onRefresh: () => void;
};

export function TransportBar({
  frameIndex,
  frameCount,
  playing,
  dwellMs,
  stamp,
  refreshing,
  onFrame,
  onTogglePlay,
  onDwell,
  onRefresh,
}: Props) {
  const max = Math.max(0, frameCount - 1);
  const speed = SPEEDS.reduce((best, item) =>
    Math.abs(item.ms - dwellMs) < Math.abs(best.ms - dwellMs) ? item : best,
  );

  return (
    <div className="glass-bar pb-safe pl-safe pr-safe relative z-20 px-3 pt-2">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Oldest frame"
            onClick={() => onFrame(0)}
          >
            <SkipBack />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous frame"
            onClick={() => onFrame(Math.max(0, frameIndex - 1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            className="size-11 rounded-full"
            aria-label={playing ? "Pause" : "Play"}
            onClick={onTogglePlay}
          >
            {playing ? <Pause /> : <Play className="ml-0.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next frame"
            onClick={() => onFrame(Math.min(max, frameIndex + 1))}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Newest frame"
            onClick={() => onFrame(max)}
          >
            <SkipForward />
          </Button>
          <label className="mx-1 min-w-0 flex-1">
            <span className="sr-only">Scrub frames</span>
            <input
              className="scrub"
              type="range"
              min={0}
              max={max}
              step={1}
              value={Math.min(frameIndex, max)}
              onChange={(event) => onFrame(Number(event.target.value))}
            />
          </label>
          <span className="hidden w-10 text-center font-mono text-[11px] text-white/70 sm:inline">
            {frameCount === 0 ? "–" : `${frameIndex + 1}/${frameCount}`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pb-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-white/55 sm:hidden">
              {frameCount === 0 ? "–" : `${frameIndex + 1}/${frameCount}`}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Animation speed"
              onClick={() => {
                const index = SPEEDS.findIndex((item) => item.ms === speed.ms);
                onDwell(SPEEDS[(index + 1) % SPEEDS.length].ms);
              }}
            >
              {speed.label}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
          <p className="truncate font-mono text-[12px] text-white/90">{stamp}</p>
        </div>
      </div>
    </div>
  );
}
