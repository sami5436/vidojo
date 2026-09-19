"use client";

import { useEffect } from "react";

/**
 * iOS does not shrink 100dvh when the software keyboard opens, so the terminal
 * would slide under it. The visual viewport does report the real height, so we
 * publish it as a CSS variable and let the layout use that instead.
 */
export function useViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport;

    const apply = () => {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
      // Safari likes to scroll the document itself when the keyboard appears.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    apply();

    viewport?.addEventListener("resize", apply);
    viewport?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      viewport?.removeEventListener("resize", apply);
      viewport?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);
}
