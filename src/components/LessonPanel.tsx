"use client";

import { useState } from "react";
import type { useLessons } from "@/hooks/useLessons";

type Props = {
  lessons: ReturnType<typeof useLessons>;
  compact: boolean;
  /** true when the editor is already showing this lesson's practice file */
  fileOpen: boolean;
};

function Chip({ label }: { label: string }) {
  return (
    <kbd className="rounded border border-edge bg-sunken px-1.5 py-0.5 text-[11px] text-accent">
      {label}
    </kbd>
  );
}

function Check({ filled }: { filled: boolean }) {
  return (
    <span
      className={[
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] leading-none",
        filled
          ? "border-accent bg-accentsoft text-accent"
          : "border-edge text-faint",
      ].join(" ")}
    >
      {filled ? "✓" : ""}
    </span>
  );
}

export default function LessonPanel({ lessons, compact, fileOpen }: Props) {
  const [listOpen, setListOpen] = useState(false);
  const {
    lesson,
    lessonIndex,
    stepIndex,
    checkpoint,
    lessonDone,
    clearedIds,
    cleared,
    total,
    hintOpen,
    toggleHint,
    flash,
  } = lessons;

  const body = (
    <>
      <div className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={() => setListOpen((open) => !open)}
          className="text-[11px] text-dim transition-colors hover:text-accent"
          aria-expanded={listOpen}
        >
          Lesson {lessonIndex + 1} of {lessons.lessons.length}
          <span className="ml-1 text-faint">{listOpen ? "▴" : "▾"}</span>
        </button>
        <span className="ml-auto text-[11px] tabular-nums text-faint">
          {cleared} of {total} done
        </span>
      </div>

      <div className="mt-1 h-0.5 w-full overflow-hidden rounded bg-sunken">
        <div
          className="h-full bg-accent transition-[width] duration-500"
          style={{ width: `${(cleared / total) * 100}%` }}
        />
      </div>

      {listOpen ? (
        <ol className="thin-scroll mt-3 max-h-64 overflow-y-auto pr-1">
          {lessons.lessons.map((entry, index) => {
            const done = clearedIds.includes(entry.id);
            const isCurrent = index === lessonIndex;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    lessons.startLesson(index);
                    setListOpen(false);
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] transition-colors",
                    isCurrent ? "bg-accentsoft text-accent" : "text-dim hover:text-fg",
                  ].join(" ")}
                >
                  <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-faint">
                    {index + 1}
                  </span>
                  <span className="truncate">{entry.title}</span>
                  {done && <span className="ml-auto text-accent">✓</span>}
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <>
          <h2 className="mt-3 text-[15px] font-bold text-fg">{lesson.title}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-dim">{lesson.blurb}</p>

          <div className="mt-4 space-y-1.5">
            {lesson.checkpoints.map((entry, index) => {
              const done = lessonDone || index < stepIndex;
              const current = !lessonDone && index === stepIndex;
              return (
                <div
                  key={entry.goal}
                  className={[
                    "flex items-start gap-2 rounded px-1.5 py-1 text-[12px] transition-colors",
                    current ? "bg-sunken text-fg" : done ? "text-faint" : "text-faint",
                  ].join(" ")}
                >
                  <span className="pt-0.5">
                    <Check filled={done} />
                  </span>
                  <span className={done ? "line-through decoration-1" : ""}>
                    {entry.goal}
                  </span>
                </div>
              );
            })}
          </div>

          {lessonDone ? (
            <div key={flash} className="mt-4 rounded border border-accent/40 bg-accentsoft px-2.5 py-2">
              <p className="text-[12px] text-accent">Lesson cleared.</p>
              <button
                type="button"
                onClick={lessons.next}
                className="mt-1.5 rounded border border-accent/50 px-2 py-1 text-[12px] text-accent transition-colors hover:bg-accent hover:text-[var(--bg)]"
              >
                Next lesson
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded border border-edge bg-sunken px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {checkpoint.keys.map((key) => (
                  <Chip key={key} label={key} />
                ))}
                <button
                  type="button"
                  onClick={toggleHint}
                  className="ml-auto text-[11px] text-faint transition-colors hover:text-accent"
                >
                  {hintOpen ? "hide hint" : "hint"}
                </button>
              </div>
              {hintOpen && (
                <p className="mt-2 text-[12px] leading-relaxed text-dim">
                  {checkpoint.hint}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={lessons.previous}
          disabled={lessonIndex === 0}
          className="rounded border border-edge px-2 py-1 text-dim transition-colors hover:text-fg disabled:opacity-40"
        >
          Back
        </button>
        {lesson.file && (
          <button
            type="button"
            onClick={lessons.restart}
            className={[
              "rounded border px-2 py-1 transition-colors",
              fileOpen
                ? "border-edge text-dim hover:text-fg"
                : "border-accent/50 text-accent hover:bg-accent hover:text-[var(--bg)]",
            ].join(" ")}
          >
            {fileOpen ? "Reset file" : "Open lesson file"}
          </button>
        )}
        <button
          type="button"
          onClick={lessons.next}
          disabled={lessonIndex === lessons.lessons.length - 1}
          className="ml-auto rounded border border-edge px-2 py-1 text-dim transition-colors hover:text-fg disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </>
  );

  if (compact) {
    return (
      <details className="shrink-0 border-b border-edge bg-raised">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[12px] text-dim">
          <Check filled={lessonDone} />
          <span className="truncate text-fg">{lesson.title}</span>
          <span className="ml-auto shrink-0 text-[11px] text-faint">
            {cleared}/{total}
          </span>
        </summary>
        <div className="px-3 pb-3">{body}</div>
      </details>
    );
  }

  return (
    <aside className="thin-scroll hidden w-[320px] shrink-0 overflow-y-auto border-l border-edge bg-raised px-3.5 py-3 lg:block">
      {body}
    </aside>
  );
}
