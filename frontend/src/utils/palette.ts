export type AppPaletteId = "rose" | "blue" | "green" | "slate";

export type AppPalette = {
  id: AppPaletteId;
  name: string;
  description: string;
  colors: {
    bg: string;
    header: string;
    border: string;
    card: string;
    cardMuted: string;
    cardBorder: string;
    accent: string;
    accentContrast: string;
  };
};

export const appPalettes: AppPalette[] = [
  {
    id: "rose",
    name: "Rosa suave",
    description: "Rosa fraco com branco",
    colors: {
      bg: "#fff7fb",
      header: "#d469b8",
      border: "#f9cfe0",
      card: "#fffafd",
      cardMuted: "#ffcaef",
      cardBorder: "#f9cfe0",
      accent: "#d469b8",
      accentContrast: "#ffffff",
    },
  },
  {
    id: "blue",
    name: "Azul",
    description: "Tons de azul",
    colors: {
      bg: "#eff6ff",
      header: "#155eef",
      border: "#bfdbfe",
      card: "#f8fbff",
      cardMuted: "#dbeafe",
      cardBorder: "#bfdbfe",
      accent: "#155eef",
      accentContrast: "#ffffff",
    },
  },
  {
    id: "green",
    name: "Verde",
    description: "Verde leve com branco",
    colors: {
      bg: "#f0fdf4",
      header: "#047857",
      border: "#bbf7d0",
      card: "#f8fff9",
      cardMuted: "#dcfce7",
      cardBorder: "#bbf7d0",
      accent: "#047857",
      accentContrast: "#ffffff",
    },
  },
  {
    id: "slate",
    name: "Clássico",
    description: "Cinza neutro",
    colors: {
      bg: "#f1f5f9",
      header: "#ffffff",
      border: "#cbd5e1",
      card: "#ffffff",
      cardMuted: "#e2e8f0",
      cardBorder: "#cbd5e1",
      accent: "#0f172a",
      accentContrast: "#ffffff",
    },
  },
];

const storageKey = "appPalette";
const storageVersionKey = "appPaletteVersion";
const currentStorageVersion = "2";

export function getStoredPaletteId(): AppPaletteId {
  if (localStorage.getItem(storageVersionKey) !== currentStorageVersion) {
    return "slate";
  }

  const stored = localStorage.getItem(storageKey);
  return appPalettes.some((palette) => palette.id === stored)
    ? (stored as AppPaletteId)
    : "slate";
}

export function applyPalette(paletteId: AppPaletteId) {
  const palette =
    appPalettes.find((candidate) => candidate.id === paletteId) ??
    appPalettes.find((candidate) => candidate.id === "slate") ??
    appPalettes[0];

  document.documentElement.style.setProperty("--app-bg", palette.colors.bg);
  document.documentElement.style.setProperty(
    "--app-header",
    palette.colors.header,
  );
  document.documentElement.style.setProperty(
    "--app-border",
    palette.colors.border,
  );
  document.documentElement.style.setProperty("--app-card", palette.colors.card);
  document.documentElement.style.setProperty(
    "--app-card-muted",
    palette.colors.cardMuted,
  );
  document.documentElement.style.setProperty(
    "--app-card-border",
    palette.colors.cardBorder,
  );
  document.documentElement.style.setProperty(
    "--app-accent",
    palette.colors.accent,
  );
  document.documentElement.style.setProperty(
    "--app-accent-contrast",
    palette.colors.accentContrast,
  );
  document.documentElement.dataset.palette = palette.id;
  localStorage.setItem(storageKey, palette.id);
  localStorage.setItem(storageVersionKey, currentStorageVersion);
}
