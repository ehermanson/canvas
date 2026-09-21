import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { HANG_TIME_URL, NumberInput, OpenHangTimeLink } from "./sidebar";

describe("OpenHangTimeLink", () => {
  it("renders a link to the Hang Time app", () => {
    render(<OpenHangTimeLink />);

    expect(screen.getByRole("link", { name: /open hang time/i }).getAttribute("href")).toBe(
      HANG_TIME_URL,
    );
  });
});

describe("NumberInput", () => {
  it("associates its visible label and preserves native arrow-key editing", () => {
    const onChange = vi.fn();
    render(<NumberInput label="Rotation" value={15} onChange={onChange} step={1} />);

    const input = screen.getByRole("spinbutton", { name: "Rotation" });
    fireEvent.change(input, { target: { value: "16" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(16);
  });
});
