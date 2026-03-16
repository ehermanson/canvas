import { fireEvent, render, screen } from "@testing-library/react";
import { FloorPlanAppIcon, HangTimeAppIcon, ToolAppSwitcher } from "@canvas-tools/ui";
import { describe, expect, it } from "vite-plus/test";
import { FLOOR_PLAN_URL, OpenFloorPlanLink } from "./sidebar";

describe("OpenFloorPlanLink", () => {
  it("renders a link to the Floor Plan app", () => {
    render(<OpenFloorPlanLink />);

    expect(screen.getByRole("link", { name: /open floor plan/i })).toHaveAttribute(
      "href",
      FLOOR_PLAN_URL,
    );
  });

  it("opens the brand switcher popover when clicked", () => {
    render(
      <ToolAppSwitcher
        currentIcon={<HangTimeAppIcon className="h-4 w-4" />}
        currentIconClassName="bg-black"
        currentTitle="Hang Time"
        currentSubtitle="Pixel Perfect Picture Placement"
        items={[
          {
            href: FLOOR_PLAN_URL,
            icon: <FloorPlanAppIcon className="h-4 w-4" />,
            iconClassName: "bg-black",
            title: "Floor Plan",
            subtitle: "Room layout studio",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /switch apps from hang time/i }));

    expect(screen.getByText(/switch app/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /floor plan/i })).toHaveAttribute(
      "href",
      FLOOR_PLAN_URL,
    );
  });
});
