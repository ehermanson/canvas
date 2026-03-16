import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { HANG_TIME_URL, OpenHangTimeLink } from "./sidebar";

describe("OpenHangTimeLink", () => {
  it("renders a link to the Hang Time app", () => {
    render(<OpenHangTimeLink />);

    expect(screen.getByRole("link", { name: /open hang time/i }).getAttribute("href")).toBe(
      HANG_TIME_URL,
    );
  });
});
