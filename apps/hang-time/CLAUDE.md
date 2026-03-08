# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.


## Build & Development Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite build
npm run preview      # Preview production build locally
npm run deploy       # Deploy to Cloudflare Workers
npm run dev:worker   # Local Cloudflare worker development
```

## Architecture Overview

This is a React/TypeScript picture hanging calculator that helps users calculate precise measurements for hanging pictures and creating gallery walls. It's deployed as a Cloudflare Workers application.

### Tech Stack
- React 18 with TypeScript
- Vite for bundling
- Tailwind CSS with shadcn/ui
    - ALWAYS check for a shadcn component before creating your own
- Cloudflare Workers for deployment

### State Management Pattern

All application state lives in the `useCalculator()` hook (`src/hooks/useCalculator.ts`). This hook:
- Manages the `CalculatorState` (wall dimensions, frame configs, layout settings)
- Returns a `Calculator` object with state and setter functions
- Uses `useMemo` to compute layout positions when state changes

Components receive the calculator object via props and call setters to update state. No external state management library is used.

### Layout Modes

Two layout types with different calculation logic (`src/utils/calculations.ts`):
- **Grid**: Frames arranged in rows/columns with configurable spacing
- **Row**: Single row of frames

### Key Types (`src/types/index.ts`)

- `CalculatorState` - Main app state
- `FramePosition` - Calculated position/measurements for each frame
- `Unit` - 'in' | 'cm'
- `LayoutType` - 'grid' | 'row'

### Component Organization

- `src/components/Sidebar/` - Input controls for all configuration (has internal sub-components)
- `src/components/Preview.tsx` - Canvas-based visual wall preview with rulers and measurement overlays
- `src/components/Measurements.tsx` - Detailed measurement display for each frame
- `src/components/ui/` - Radix UI component wrappers

### File Naming Conventions

- Use `kebab-case` for all file names (e.g., `how-to-hang.tsx`, `use-calculator.ts`)
- No barrel files (`index.ts`) for single-export modules - just use the file directly with a named export
- Only use directories for components with multiple internal sub-components (e.g., `Sidebar/`)

### Cloudflare Workers Setup

- `src/worker.ts` - Worker entry point
- Static assets served automatically via wrangler assets binding
- `wrangler.toml` configures worker name and asset directory
