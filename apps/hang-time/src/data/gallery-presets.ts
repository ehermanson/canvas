import type {
  AnchorType,
  Distribution,
  FrameFurnitureAlignment,
  FurnitureAnchor,
  FurnitureVerticalAnchor,
  GalleryFrame,
  GalleryRowConfig,
  GalleryVAlign,
  HorizontalAnchorType,
} from "@/types";

export interface GalleryPreset {
  id: string;
  name: string;
  description: string;
  frames: GalleryFrame[];
  settings: {
    uniformSize: boolean;
    frameWidth?: number;
    frameHeight?: number;
    hSpacing: number;
    hDistribution: Distribution;
    vAlign: GalleryVAlign;
    rowSpacing: number;
    rowConfigs: GalleryRowConfig[];
    anchorType: AnchorType;
    anchorValue: number;
    hAnchorType: HorizontalAnchorType;
    // Furniture settings (when anchorType === 'furniture')
    furnitureWidth?: number;
    furnitureHeight?: number;
    furnitureAnchor?: FurnitureAnchor;
    furnitureOffset?: number;
    frameFurnitureAlign?: FrameFurnitureAlignment;
    furnitureVAnchor?: FurnitureVerticalAnchor;
  };
}

// Helper to generate unique IDs
let idCounter = 0;
function genId(): string {
  return `preset-${++idCounter}`;
}

export const GALLERY_PRESETS: GalleryPreset[] = [
  {
    id: "varied-trio",
    name: "Classic Trio",
    description: "3 frames, varied sizes",
    frames: [
      { id: genId(), width: 11, height: 14, row: 0 },
      { id: genId(), width: 16, height: 20, row: 0 },
      { id: genId(), width: 11, height: 14, row: 0 },
    ],
    settings: {
      uniformSize: false,
      hSpacing: 3,
      hDistribution: "fixed",
      vAlign: "center",
      rowSpacing: 3,
      rowConfigs: [],
      anchorType: "floor",
      anchorValue: 57,
      hAnchorType: "center",
    },
  },
  {
    id: "salon-style",
    name: "Salon Style",
    description: "5 frames, 2 rows",
    frames: [
      { id: genId(), width: 8, height: 10, row: 0 },
      { id: genId(), width: 11, height: 14, row: 0 },
      { id: genId(), width: 8, height: 10, row: 0 },
      { id: genId(), width: 16, height: 20, row: 1 },
      { id: genId(), width: 12, height: 12, row: 1 },
    ],
    settings: {
      uniformSize: false,
      hSpacing: 2.5,
      hDistribution: "fixed",
      vAlign: "bottom",
      rowSpacing: 2.5,
      rowConfigs: [{ id: "row-1", vAlign: "top" }],
      anchorType: "floor",
      anchorValue: 57,
      hAnchorType: "center",
    },
  },
  {
    id: "grid-four",
    name: "Perfect Grid",
    description: "4 uniform frames",
    frames: [
      { id: genId(), width: 12, height: 12, row: 0 },
      { id: genId(), width: 12, height: 12, row: 0 },
      { id: genId(), width: 12, height: 12, row: 1 },
      { id: genId(), width: 12, height: 12, row: 1 },
    ],
    settings: {
      uniformSize: true,
      frameWidth: 12,
      frameHeight: 12,
      hSpacing: 3,
      hDistribution: "fixed",
      vAlign: "center",
      rowSpacing: 3,
      rowConfigs: [],
      anchorType: "floor",
      anchorValue: 57,
      hAnchorType: "center",
    },
  },
  {
    id: "pyramid",
    name: "Pyramid",
    description: "Ascending & descending",
    frames: [
      { id: genId(), width: 8, height: 10, row: 0 },
      { id: genId(), width: 11, height: 14, row: 0 },
      { id: genId(), width: 16, height: 20, row: 0 },
      { id: genId(), width: 11, height: 14, row: 0 },
      { id: genId(), width: 8, height: 10, row: 0 },
    ],
    settings: {
      uniformSize: false,
      hSpacing: 2,
      hDistribution: "fixed",
      vAlign: "center",
      rowSpacing: 3,
      rowConfigs: [],
      anchorType: "floor",
      anchorValue: 57,
      hAnchorType: "center",
    },
  },
  {
    id: "above-sofa",
    name: "Above Sofa",
    description: "3 frames over furniture",
    frames: [
      { id: genId(), width: 11, height: 14, row: 0 },
      { id: genId(), width: 16, height: 20, row: 0 },
      { id: genId(), width: 11, height: 14, row: 0 },
    ],
    settings: {
      uniformSize: false,
      hSpacing: 3,
      hDistribution: "fixed",
      vAlign: "center",
      rowSpacing: 3,
      rowConfigs: [],
      anchorType: "furniture",
      anchorValue: 8,
      hAnchorType: "center",
      furnitureWidth: 72,
      furnitureHeight: 52,
      furnitureAnchor: "center",
      furnitureOffset: 0,
      frameFurnitureAlign: "center",
      furnitureVAnchor: "above-furniture",
    },
  },
  {
    id: "mirror-gallery",
    name: "Mirror Gallery",
    description: "10 frames, stacked pyramids",
    frames: [
      { id: genId(), width: 8, height: 10, row: 0 },
      { id: genId(), width: 11, height: 14, row: 0 },
      { id: genId(), width: 16, height: 20, row: 0 },
      { id: genId(), width: 11, height: 14, row: 0 },
      { id: genId(), width: 8, height: 10, row: 0 },
      { id: genId(), width: 8, height: 10, row: 1 },
      { id: genId(), width: 11, height: 14, row: 1 },
      { id: genId(), width: 16, height: 20, row: 1 },
      { id: genId(), width: 11, height: 14, row: 1 },
      { id: genId(), width: 8, height: 10, row: 1 },
    ],
    settings: {
      uniformSize: false,
      hSpacing: 2.25,
      hDistribution: "fixed",
      vAlign: "center",
      rowSpacing: 2.25,
      rowConfigs: [
        { id: "row-0", vAlign: "bottom" },
        { id: "row-1", vAlign: "top" },
      ],
      anchorType: "ceiling",
      anchorValue: 6,
      hAnchorType: "center",
    },
  },
];

// Default preset to use on initial load
export const DEFAULT_PRESET = GALLERY_PRESETS[0];
