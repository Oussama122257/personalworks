import { getSettings } from "@/lib/settings";

/** Converts #RRGGBB to the "H S% L%" triple the Tailwind tokens expect. */
function hexToHsl(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Applies the admin's branding: overrides the CSS colour tokens and appends any
 * custom CSS. Server component — the values come straight from the database, so
 * a saved change is live on the next request.
 */
export async function ThemeInjector() {
  const theme = await getSettings("theme");

  const primary = hexToHsl(theme.primaryColor);
  const secondary = hexToHsl(theme.secondaryColor);
  const accent = hexToHsl(theme.accentColor);

  const vars = [
    primary && `--primary: ${primary};`,
    primary && `--ring: ${primary};`,
    secondary && `--secondary: ${secondary};`,
    accent && `--accent: ${accent};`,
  ]
    .filter(Boolean)
    .join(" ");

  if (!vars && !theme.customCss.trim()) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root{${vars}}\n${theme.customCss}`,
      }}
    />
  );
}
