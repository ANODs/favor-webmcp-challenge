"use client";

import Lenis from "lenis";
import { useEffect } from "react";

export function HomeSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      allowNestedScroll: true,
      anchors: true,
      autoRaf: true,
      lerp: 0.12,
      respectReducedMotion: true,
      smoothWheel: true,
      stopInertiaOnNavigate: true,
      syncTouch: false,
    });

    return () => lenis.destroy();
  }, []);

  return null;
}
