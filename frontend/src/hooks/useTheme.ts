import { useCallback, useEffect, useState } from "react";
import { apiPatch } from "../api/client.ts";

export type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  const apply = useCallback((next: Theme) => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", next === "dark" || (next === "system" && prefersDark));
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      apply(next);
      apiPatch("/api/account/preferences", { theme: next }).catch(() => undefined);
    },
    [apply]
  );

  useEffect(() => {
    apply(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply(theme);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [apply, theme]);

  return { theme, setTheme };
}
