"use client";

import { useState } from "react";
import TopBar, { type AppMode } from "@/components/TopBar";
import { useDevice } from "@/hooks/useDevice";
import { useTheme } from "@/hooks/useTheme";

export default function Vidojo() {
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<AppMode>("learn");
  const device = useDevice();

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-bg">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        theme={theme}
        onThemeToggle={toggle}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center p-6 text-[13px] text-dim">
        <div className="flex flex-col gap-1">
          <span className="text-accent">vidojo boot</span>
          <span>mode: {mode}</span>
          <span>
            input: {device.ready ? (device.isMobile ? "key bar" : "keyboard") : "..."}
          </span>
        </div>
      </main>
    </div>
  );
}
