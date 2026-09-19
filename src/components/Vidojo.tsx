"use client";

import { useCallback, useState } from "react";
import KeyBar from "@/components/KeyBar";
import LessonPanel from "@/components/LessonPanel";
import Terminal from "@/components/Terminal";
import TopBar, { type AppMode } from "@/components/TopBar";
import { useDevice } from "@/hooks/useDevice";
import { useLessons } from "@/hooks/useLessons";
import { useSession } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import type { Probe } from "@/lib/lessons/types";

export default function Vidojo() {
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<AppMode>("learn");
  const device = useDevice();
  useViewportHeight();

  // The lessons hook needs the session to load files and the session needs the
  // lessons hook to receive probes. A tiny state holder breaks the cycle.
  const [observer, setObserver] = useState<{ run: (probe: Probe) => void }>({
    run: () => {},
  });

  const onProbe = useCallback((probe: Probe) => observer.run(probe), [observer]);
  const session = useSession(onProbe);
  const lessons = useLessons(session.loadFile, mode === "learn");

  if (observer.run !== lessons.observe) {
    setObserver({ run: lessons.observe });
  }

  const onModeChange = useCallback(
    (next: AppMode) => {
      setMode(next);
      if (next === "learn") lessons.startLesson(lessons.lessonIndex);
    },
    [lessons],
  );

  const fileOpen =
    lessons.lesson.file !== undefined &&
    session.editor?.path === lessons.lesson.file.path;

  return (
    <div
      className="flex w-full flex-col bg-bg"
      style={{ height: "var(--app-height, 100dvh)" }}
    >
      <TopBar
        mode={mode}
        onModeChange={onModeChange}
        theme={theme}
        onThemeToggle={toggle}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {mode === "learn" && (
          <LessonPanel
            lessons={lessons}
            compact={device.isNarrow}
            fileOpen={fileOpen}
          />
        )}
        <Terminal session={session} />
      </div>

      {device.isMobile && (
        <KeyBar
          onKey={session.sendKey}
          screen={session.screen}
          mode={session.editor?.mode ?? null}
        />
      )}
    </div>
  );
}
