import { useSyncExternalStore } from "react";

// Tailwind `lg` breakpoint - the point where the sidebar stops being a
// slide-over drawer and becomes a permanent column.
const DESKTOP_QUERY = "(min-width: 1024px)";

const mql = window.matchMedia(DESKTOP_QUERY);

const subscribe = (onChange) => {
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};

const getSnapshot = () => mql.matches;

/**
 * useIsDesktop - true when the viewport is at/above the `lg` breakpoint.
 * Used for behaviour that CSS alone can't express (which elements render,
 * whether a nav click should close the drawer).
 */
export default function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
