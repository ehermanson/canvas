import type { FurniturePreset, PulloutBedSize, PulloutSofaState } from "@/types";

type PulloutDefaults = Omit<PulloutSofaState, "isOpen">;

export const PULLOUT_SOFA_DEFAULTS: Record<PulloutBedSize, PulloutDefaults> = {
  twin: {
    bedSize: "twin",
    closedWidth: 60,
    closedDepth: 38,
    openWidth: 60,
    openDepth: 75,
  },
  full: {
    bedSize: "full",
    closedWidth: 72,
    closedDepth: 38,
    openWidth: 72,
    openDepth: 75,
  },
  queen: {
    bedSize: "queen",
    closedWidth: 84,
    closedDepth: 38,
    openWidth: 84,
    openDepth: 80,
  },
  king: {
    bedSize: "king",
    closedWidth: 96,
    closedDepth: 40,
    openWidth: 96,
    openDepth: 80,
  },
};

export const FURNITURE_PRESETS: FurniturePreset[] = [
  // Beds
  {
    type: "bed",
    name: "Twin Bed",
    shape: "rectangle",
    width: 39,
    depth: 75,
    color: "#6366f1",
  },
  {
    type: "bed",
    name: "Full Bed",
    shape: "rectangle",
    width: 54,
    depth: 75,
    color: "#6366f1",
  },
  {
    type: "bed",
    name: "Queen Bed",
    shape: "rectangle",
    width: 60,
    depth: 80,
    color: "#6366f1",
  },
  {
    type: "bed",
    name: "King Bed",
    shape: "rectangle",
    width: 76,
    depth: 80,
    color: "#6366f1",
  },

  // Seating
  {
    type: "couch",
    name: "Sofa (3-seat)",
    shape: "rectangle",
    width: 84,
    depth: 36,
    color: "#8b5cf6",
  },
  {
    type: "couch",
    name: "Loveseat",
    shape: "rectangle",
    width: 60,
    depth: 36,
    color: "#8b5cf6",
  },
  {
    type: "pullout-sofa",
    name: "Pull-out Sofa",
    shape: "rectangle",
    width: PULLOUT_SOFA_DEFAULTS.queen.closedWidth,
    depth: PULLOUT_SOFA_DEFAULTS.queen.closedDepth,
    color: "#7c3aed",
    pulloutSofa: {
      ...PULLOUT_SOFA_DEFAULTS.queen,
      isOpen: false,
    },
  },
  {
    type: "chair",
    name: "Armchair",
    shape: "rectangle",
    width: 34,
    depth: 34,
    color: "#a78bfa",
  },
  {
    type: "chair",
    name: "Office Chair",
    shape: "circle",
    width: 26,
    depth: 26,
    color: "#a78bfa",
  },
  {
    type: "chair",
    name: "Dining Chair",
    shape: "rectangle",
    width: 18,
    depth: 20,
    color: "#c4b5fd",
  },

  // Tables
  {
    type: "dining-table",
    name: "Dining Table (6)",
    shape: "rectangle",
    width: 72,
    depth: 36,
    color: "#f59e0b",
  },
  {
    type: "dining-table",
    name: "Dining Table (4)",
    shape: "rectangle",
    width: 48,
    depth: 36,
    color: "#f59e0b",
  },
  {
    type: "dining-table",
    name: "Round Table",
    shape: "circle",
    width: 48,
    depth: 48,
    color: "#f59e0b",
  },
  {
    type: "coffee-table",
    name: "Coffee Table",
    shape: "rectangle",
    width: 48,
    depth: 24,
    color: "#d97706",
  },
  {
    type: "table",
    name: "Side Table",
    shape: "rectangle",
    width: 24,
    depth: 24,
    color: "#d97706",
  },
  {
    type: "table",
    name: "Round Side Table",
    shape: "circle",
    width: 20,
    depth: 20,
    color: "#d97706",
  },

  // Desks
  {
    type: "desk",
    name: "Desk (Standard)",
    shape: "rectangle",
    width: 60,
    depth: 30,
    color: "#0ea5e9",
  },
  {
    type: "desk",
    name: "Desk (Large)",
    shape: "rectangle",
    width: 72,
    depth: 36,
    color: "#0ea5e9",
  },
  {
    type: "desk",
    name: "Desk (Compact)",
    shape: "rectangle",
    width: 48,
    depth: 24,
    color: "#0ea5e9",
  },

  // Storage
  {
    type: "bookshelf",
    name: "Bookshelf",
    shape: "rectangle",
    width: 36,
    depth: 12,
    color: "#10b981",
  },
  {
    type: "bookshelf",
    name: "Wide Bookshelf",
    shape: "rectangle",
    width: 60,
    depth: 12,
    color: "#10b981",
  },
  {
    type: "dresser",
    name: "Dresser",
    shape: "rectangle",
    width: 60,
    depth: 18,
    color: "#14b8a6",
  },
  {
    type: "nightstand",
    name: "Nightstand",
    shape: "rectangle",
    width: 24,
    depth: 16,
    color: "#14b8a6",
  },
  {
    type: "wardrobe",
    name: "Wardrobe",
    shape: "rectangle",
    width: 48,
    depth: 24,
    color: "#059669",
  },
  {
    type: "tv-stand",
    name: "TV Stand",
    shape: "rectangle",
    width: 60,
    depth: 18,
    color: "#64748b",
  },

  // Rugs
  {
    type: "rug",
    name: "Area Rug (5x8)",
    shape: "rectangle",
    width: 60,
    depth: 96,
    color: "#e879791a",
  },
  {
    type: "rug",
    name: "Area Rug (8x10)",
    shape: "rectangle",
    width: 96,
    depth: 120,
    color: "#e879791a",
  },
  {
    type: "rug",
    name: "Round Rug (6ft)",
    shape: "circle",
    width: 72,
    depth: 72,
    color: "#e879791a",
  },
];

export const FURNITURE_CATEGORIES = [
  { label: "Beds", types: ["bed", "pullout-sofa"] as const },
  { label: "Seating", types: ["couch", "pullout-sofa", "chair"] as const },
  {
    label: "Tables",
    types: ["dining-table", "coffee-table", "table"] as const,
  },
  { label: "Desks", types: ["desk"] as const },
  {
    label: "Storage",
    types: ["bookshelf", "dresser", "nightstand", "wardrobe", "tv-stand"] as const,
  },
  { label: "Rugs", types: ["rug"] as const },
];
