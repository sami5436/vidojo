"use client";

import { useState } from "react";
import Terminal from "@/components/Terminal";
import TopBar, { type AppMode } from "@/components/TopBar";
import { useSession } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";

export default function Vidojo() {
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<AppMode>("learn");
  const session = useSession();

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-bg">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        theme={theme}
        onThemeToggle={toggle}
      />
      <Terminal session={session} />
    </div>
  );
}
