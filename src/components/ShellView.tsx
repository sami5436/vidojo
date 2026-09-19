"use client";

import { useEffect, useRef } from "react";
import { promptFor } from "@/lib/shell/commands";
import type { OutLine, Tone } from "@/lib/shell/types";

const TONE: Record<Tone, string> = {
  fg: "text-[var(--fg)]",
  dim: "text-[var(--fg-dim)]",
  faint: "text-[var(--fg-faint)]",
  err: "text-[var(--err)]",
  warn: "text-[var(--warn)]",
  info: "text-[var(--info)]",
  dir: "text-[var(--info)] font-medium",
  exec: "text-[var(--accent)] font-medium",
  accent: "text-[var(--accent)]",
};

function Line({ spans }: { spans: OutLine }) {
  if (spans.length === 0) return <div className="h-[1.55em]" />;
  return (
    <div className="whitespace-pre-wrap break-words">
      {spans.map((span, index) => (
        <span key={index} className={TONE[span.tone ?? "fg"]}>
          {span.text}
        </span>
      ))}
    </div>
  );
}

type Props = {
  scrollback: OutLine[];
  cwd: string;
  input: string;
  inputCol: number;
  focused: boolean;
};

export default function ShellView({
  scrollback,
  cwd,
  input,
  inputCol,
  focused,
}: Props) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [scrollback, input]);

  const before = input.slice(0, inputCol);
  const under = input.slice(inputCol, inputCol + 1) || " ";
  const after = input.slice(inputCol + 1);

  return (
    <div className="thin-scroll h-full overflow-y-auto px-3 py-2 text-[13px] leading-[1.55] sm:px-4">
      {scrollback.map((spans, index) => (
        <Line key={index} spans={spans} />
      ))}

      <div className="whitespace-pre-wrap break-words">
        {promptFor(cwd).map((span, index) => (
          <span key={index} className={TONE[span.tone ?? "fg"]}>
            {span.text}
          </span>
        ))}
        <span className="text-[var(--fg)]">{before}</span>
        <span
          className={[
            "text-[var(--fg)]",
            focused
              ? "cursor-blink bg-[var(--cursor)] text-[var(--bg)]"
              : "outline outline-1 outline-[var(--cursor)]",
          ].join(" ")}
        >
          {under}
        </span>
        <span className="text-[var(--fg)]">{after}</span>
      </div>

      <div ref={bottom} className="h-2" />
    </div>
  );
}
