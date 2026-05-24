import { createTheme, alpha } from "@mui/material/styles";

/** Shared tokens for React Flow (used outside MUI components). */
export const treeTokens = {
  canvasDefault: "#0f1419",
  edgeStroke: "rgba(148, 163, 184, 0.5)",
  edgeStrokeWidth: 1.25,
  characteristic: "#38bdf8",
  treatment: "#34d399",
  nodeShadow: "0 4px 14px rgba(0, 0, 0, 0.45)",
  nodeHoverShadow: "0 6px 20px rgba(0, 0, 0, 0.55)",
};

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#6366f1",
      light: "#818cf8",
      dark: "#4f46e5",
    },
    secondary: {
      main: "#a78bfa",
    },
    info: {
      main: treeTokens.characteristic,
    },
    success: {
      main: treeTokens.treatment,
    },
    background: {
      default: treeTokens.canvasDefault,
      paper: "#1a2332",
    },
    divider: alpha("#94a3b8", 0.2),
    text: {
      primary: "#e2e8f0",
      secondary: "#94a3b8",
    },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    h3: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: treeTokens.canvasDefault,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#141c27",
          borderBottom: `1px solid ${alpha("#94a3b8", 0.15)}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: "#141c27",
          borderRight: `1px solid ${alpha("#94a3b8", 0.15)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${alpha("#94a3b8", 0.12)}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

/** Blend a tree accent into the dark canvas for drilled-in views. */
export function blendCanvasColor(accent: string | undefined): string {
  if (!accent) return treeTokens.canvasDefault;
  return `color-mix(in srgb, ${accent} 22%, ${treeTokens.canvasDefault})`;
}

/** Canvas fill with optional radial accent when viewing a specific tree. */
export function canvasBackground(accent: string | undefined): string {
  const base = blendCanvasColor(accent);
  if (!accent) return base;
  return `radial-gradient(ellipse 90% 70% at 15% 0%, color-mix(in srgb, ${accent} 32%, transparent), transparent 65%), ${base}`;
}

/** Saturated fill for overview root circles. */
export function hashNodeColor(str: string): string {
  let h = 0;
  let s = 0;
  let l = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    s = (s << 3) - s + str.charCodeAt(i);
    l = (l << 2) - l + str.charCodeAt(i);
  }
  const hue = Math.abs(h % 360);
  const sat = 62 + (Math.abs(s) % 18);
  const light = 48 + (Math.abs(l) % 10);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/** Pick readable text on a given HSL background. */
export function textOnColor(hslColor: string): string {
  const match = hslColor.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i);
  if (!match) return "#e2e8f0";
  const lightness = Number(match[3]);
  return lightness > 58 ? "#0f172a" : "#f8fafc";
}
