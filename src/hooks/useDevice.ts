"use client";

import { useEffect, useState } from "react";

export type Device = {
  /** true once we have actually measured the client, false during SSR */
  ready: boolean;
  isTouch: boolean;
  isNarrow: boolean;
  /** touch plus a narrow viewport means we drive the on screen key bar */
  isMobile: boolean;
};

const NARROW = 820;

export function useDevice(): Device {
  const [device, setDevice] = useState<Device>({
    ready: false,
    isTouch: false,
    isNarrow: false,
    isMobile: false,
  });

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia(`(max-width: ${NARROW}px)`);

    const read = () => {
      const isTouch = coarse.matches || navigator.maxTouchPoints > 0;
      const isNarrow = narrow.matches;
      setDevice({
        ready: true,
        isTouch,
        isNarrow,
        isMobile: isTouch && isNarrow,
      });
    };

    read();
    coarse.addEventListener("change", read);
    narrow.addEventListener("change", read);
    return () => {
      coarse.removeEventListener("change", read);
      narrow.removeEventListener("change", read);
    };
  }, []);

  return device;
}
