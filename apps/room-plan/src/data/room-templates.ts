import type { RoomTemplate } from '@/types';

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    name: 'Rectangle (12x10)',
    description: 'Standard rectangular room',
    vertices: [
      { x: 0, y: 0 },
      { x: 144, y: 0 },
      { x: 144, y: 120 },
      { x: 0, y: 120 },
    ],
  },
  {
    name: 'Square (12x12)',
    description: 'Square room',
    vertices: [
      { x: 0, y: 0 },
      { x: 144, y: 0 },
      { x: 144, y: 144 },
      { x: 0, y: 144 },
    ],
  },
  {
    name: 'Large (16x14)',
    description: 'Large rectangular room',
    vertices: [
      { x: 0, y: 0 },
      { x: 192, y: 0 },
      { x: 192, y: 168 },
      { x: 0, y: 168 },
    ],
  },
  {
    name: 'L-Shape',
    description: 'L-shaped room',
    vertices: [
      { x: 0, y: 0 },
      { x: 192, y: 0 },
      { x: 192, y: 96 },
      { x: 120, y: 96 },
      { x: 120, y: 168 },
      { x: 0, y: 168 },
    ],
  },
  {
    name: 'T-Shape',
    description: 'T-shaped room',
    vertices: [
      { x: 48, y: 0 },
      { x: 192, y: 0 },
      { x: 192, y: 72 },
      { x: 144, y: 72 },
      { x: 144, y: 168 },
      { x: 48, y: 168 },
      { x: 48, y: 72 },
      { x: 0, y: 72 },
      { x: 0, y: 0 },
    ],
  },
  {
    name: 'Studio Apartment',
    description: 'Open studio with alcove',
    vertices: [
      { x: 0, y: 0 },
      { x: 240, y: 0 },
      { x: 240, y: 168 },
      { x: 168, y: 168 },
      { x: 168, y: 216 },
      { x: 72, y: 216 },
      { x: 72, y: 168 },
      { x: 0, y: 168 },
    ],
  },
  {
    name: 'Bay Window',
    description: 'Room with bay window bump-out',
    vertices: [
      { x: 0, y: 0 },
      { x: 48, y: 0 },
      { x: 48, y: -24 },
      { x: 120, y: -24 },
      { x: 120, y: 0 },
      { x: 168, y: 0 },
      { x: 168, y: 144 },
      { x: 0, y: 144 },
    ],
  },
];
