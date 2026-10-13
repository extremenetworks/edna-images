import { useCallback, useEffect, useRef, useState } from 'react';

export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Animates from the previous target value to the new one whenever `target` changes. */
export function useCountUp(
  target: number,
  duration = 1500,
  easing: (t: number) => number = easeOutExpo,
  delay = 0,
  enabled = true,
): number {
  const [display, setDisplay] = useState(0);
  const prevTarget = useRef(0);
  const frame = useRef(0);

  const animate = useCallback(
    (from: number, to: number) => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (!enabled || duration <= 0) {
        setDisplay(to);
        return;
      }
      let start: number | null = null;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const elapsed = ts - start;
        if (elapsed < delay) {
          frame.current = requestAnimationFrame(step);
          return;
        }
        const t = Math.min((elapsed - delay) / duration, 1);
        setDisplay(from + (to - from) * easing(t));
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [duration, easing, delay, enabled],
  );

  useEffect(() => {
    animate(prevTarget.current, target);
    prevTarget.current = target;
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, animate]);

  return display;
}
