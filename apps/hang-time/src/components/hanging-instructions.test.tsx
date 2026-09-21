import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { CalculatorState } from "@/types";
import type { UseCalculatorReturn } from "@/hooks/use-calculator";
import { calculateLayout } from "@/utils/calculations";
import { HowToHang } from "./how-to-hang";
import { Measurements } from "./measurements";

function calculator(overrides: Partial<CalculatorState> = {}) {
  const state: CalculatorState = {
    unit: "in",
    wallWidth: 120,
    wallHeight: 96,
    frames: [{ id: "a", width: 16, height: 20, row: 0 }],
    uniformSize: false,
    frameWidth: 16,
    frameHeight: 20,
    hangingOffset: 2,
    hangingType: "dual",
    hookInset: 3,
    hSpacing: 3,
    hDistribution: "fixed",
    anchorType: "center",
    anchorValue: 0,
    hAnchorType: "center",
    hAnchorValue: 0,
    furnitureWidth: 48,
    furnitureHeight: 30,
    furnitureAnchor: "center",
    furnitureOffset: 0,
    frameFurnitureAlign: "center",
    furnitureVAnchor: "above-furniture",
    rowSpacing: 3,
    rowConfigs: [],
    vAlign: "center",
    ...overrides,
  };
  const layoutResult = calculateLayout(state);
  return { state, layoutResult, layoutPositions: layoutResult.positions } as UseCalculatorReturn;
}

describe("Hanging instructions", () => {
  it("gives both absolute hook coordinates and installation steps without the measurements tab", () => {
    render(<HowToHang calculator={calculator()} />);
    expect(screen.getByText(/Mark the left hook/).textContent).toContain('55"');
    expect(screen.getByText(/Mark the right hook/).textContent).toContain('65"');
    expect(screen.getByText(/Mark the right hook/).textContent).toContain('56"');
    expect(screen.getByText(/marks must be/).textContent).toContain('10"');
    expect(screen.getByText(/Use a level/)).toBeTruthy();
    expect(screen.getByText(/Install hardware at both marks/)).toBeTruthy();
  });

  it("provides single-hook coordinates in centimeters", () => {
    render(<HowToHang calculator={calculator({ hangingType: "center", unit: "cm" })} />);
    expect(screen.getByText(/Mark the hook/).textContent).toContain("152.4 cm");
    expect(screen.getByText(/Mark the hook/).textContent).toContain("142.2 cm");
    expect(screen.queryByText(/right hook/)).toBeNull();
    expect(screen.getByText(/Install the hook or nail/)).toBeTruthy();
  });

  it("replaces installation instructions with an actionable hardware error", () => {
    const invalid = calculator({ hookInset: 8 });
    render(<HowToHang calculator={invalid} />);
    expect(screen.getByRole("alert").textContent).toContain("Frame 1");
    expect(screen.getByRole("alert").textContent).toContain("less than half");
    expect(screen.queryByText(/Install hardware/)).toBeNull();
  });

  it("also warns on the measurement tab when frames overlap", () => {
    render(
      <Measurements
        calculator={calculator({
          frames: [
            { id: "a", width: 70, height: 20, row: 0 },
            { id: "b", width: 70, height: 20, row: 0 },
          ],
          hDistribution: "space-between",
        })}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain('20" more wall width');
    expect(screen.getByRole("alert").textContent).toContain("Frame 1 and Frame 2 overlap");
  });
});
