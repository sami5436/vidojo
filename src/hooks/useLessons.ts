"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LESSONS, TOTAL_CHECKPOINTS } from "@/lib/lessons/lessons";
import {
  getProgress,
  getServerProgress,
  setProgress,
  subscribe,
  type Progress,
} from "@/lib/lessons/progress";
import type { Probe } from "@/lib/lessons/types";

type LoadFile = (path: string, lines: string[]) => void;

export function useLessons(loadFile: LoadFile, active: boolean) {
  const progress = useSyncExternalStore(subscribe, getProgress, getServerProgress);
  const [hintOpen, setHintOpen] = useState(false);
  const [flash, setFlash] = useState(0);

  // Keys and commands pile up until the current checkpoint is cleared.
  const keysRef = useRef<string[]>([]);
  const commandsRef = useRef<string[]>([]);

  const lessonIndex = Math.min(progress.lesson, LESSONS.length - 1);
  const lesson = LESSONS[lessonIndex];
  const stepIndex = Math.min(progress.step, lesson.checkpoints.length - 1);
  const checkpoint = lesson.checkpoints[stepIndex];
  const lessonDone = progress.cleared.includes(lesson.id);

  const cleared = useMemo(() => {
    const before = LESSONS.slice(0, lessonIndex).reduce(
      (sum, entry) =>
        sum + (progress.cleared.includes(entry.id) ? entry.checkpoints.length : 0),
      0,
    );
    return before + (lessonDone ? lesson.checkpoints.length : stepIndex);
  }, [lesson.checkpoints.length, lessonDone, lessonIndex, progress.cleared, stepIndex]);

  const write = useCallback(
    (next: Partial<Progress>) => {
      setProgress({ ...getProgress(), ...next });
    },
    [],
  );

  const startLesson = useCallback(
    (index: number) => {
      const target = LESSONS[Math.max(0, Math.min(index, LESSONS.length - 1))];
      keysRef.current = [];
      commandsRef.current = [];
      setHintOpen(false);
      write({ lesson: LESSONS.indexOf(target), step: 0 });
      if (target.file) loadFile(target.file.path, [...target.file.lines]);
    },
    [loadFile, write],
  );

  const observe = useCallback(
    (probe: Probe) => {
      if (!active) return;

      keysRef.current = [...keysRef.current.slice(-400), ...probe.keys];
      commandsRef.current = [...commandsRef.current.slice(-60), ...probe.commands];

      const current = getProgress();
      const activeLesson = LESSONS[Math.min(current.lesson, LESSONS.length - 1)];
      if (current.cleared.includes(activeLesson.id)) return;

      const step = Math.min(current.step, activeLesson.checkpoints.length - 1);
      const test = activeLesson.checkpoints[step];

      const enriched: Probe = {
        ...probe,
        keys: keysRef.current,
        commands: commandsRef.current,
      };

      let passed = false;
      try {
        passed = test.done(enriched);
      } catch {
        // a checkpoint should never throw, but one bad test must not wedge the app
        passed = false;
      }

      if (!passed) return;

      keysRef.current = [];
      commandsRef.current = [];
      setHintOpen(false);
      setFlash((n) => n + 1);

      if (step + 1 < activeLesson.checkpoints.length) {
        setProgress({ ...current, step: step + 1 });
        return;
      }

      setProgress({
        ...current,
        step,
        cleared: [...current.cleared, activeLesson.id],
      });
    },
    [active],
  );

  const next = useCallback(() => {
    startLesson(lessonIndex + 1);
  }, [lessonIndex, startLesson]);

  const previous = useCallback(() => {
    startLesson(lessonIndex - 1);
  }, [lessonIndex, startLesson]);

  const restart = useCallback(() => {
    const current = getProgress();
    setProgress({
      ...current,
      step: 0,
      cleared: current.cleared.filter((id) => id !== lesson.id),
    });
    keysRef.current = [];
    commandsRef.current = [];
    setHintOpen(false);
    if (lesson.file) loadFile(lesson.file.path, [...lesson.file.lines]);
  }, [lesson, loadFile]);

  return {
    lessons: LESSONS,
    lesson,
    lessonIndex,
    stepIndex,
    checkpoint,
    lessonDone,
    clearedIds: progress.cleared,
    cleared,
    total: TOTAL_CHECKPOINTS,
    hintOpen,
    toggleHint: () => setHintOpen((open) => !open),
    flash,
    observe,
    startLesson,
    next,
    previous,
    restart,
  };
}
