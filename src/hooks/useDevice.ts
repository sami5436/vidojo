"use client";

import { useEffect, useState } from "react";

export type Device = {
  /** false during the server render, true once the client has measured */
  ready: boolean;
  isTouch: boolean;
  /** narrower than the breakpoint where the lesson panel sits beside the terminal */
  isNarrow: boolean;
  /** a phone or tablet, where the on screen key bar earns its space */
  isMobile: boolean;
};

/** Matches the lg breakpoint the layout uses to put the panel on the side. */
const NARROW = 1023;

export function useDevice(): Device {
  const [device, setDevice] = useState<Device>({
    ready: false,
    isTouch: false,
    isNarrow: false,
    isMobile: false,
  });

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const noHover = window.matchMedia("(hover: none)");
    const narrow = window.matchMedia(`(max-width: ${NARROW}px)`);

    const read = () => {
      const isTouch = coarse.matches || navigator.maxTouchPoints > 0;
      setDevice({
        ready: true,
        isTouch,
        isNarrow: narrow.matches,
        // A touch laptop still has a real keyboard, so hover is the tiebreak.
        isMobile: isTouch && noHover.matches,
      });
    };

    read();
    for (const query of [coarse, noHover, narrow]) {
      query.addEventListener("change", read);
    }
    return () => {
      for (const query of [coarse, noHover, narrow]) {
        query.removeEventListener("change", read);
      }
    };
  }, []);

  return device;
}
