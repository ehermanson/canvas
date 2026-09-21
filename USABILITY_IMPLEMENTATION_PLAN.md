# Usability implementation plan

Scope: the eleven findings from the usability review. Account/login work is excluded. Existing saved layouts remain compatible. No deployment is part of this change.

## Execution ownership

- Sol A: Floor Plan geometry and room constraints (`lib/furniture-geometry*`, new constraint helpers, `hooks/use-floor-planner*`).
- Sol B: Floor Plan canvas interaction and accessibility (`components/canvas*`, `components/Sidebar/*`). Coordinate helper contracts with Sol A before integrating.
- Sol C: Hang Time placement, validation, instructions, and touch interaction (`apps/hang-time/src/**`).
- Lead: integration review, cross-app verification, full checks, and follow-up fixes. Agents must not edit another owner's files without coordination.

## 1. Oval furniture geometry

Implement shared ellipse-aware point containment, rotated bounds, edge/support points, and collision behavior. Rendering, selection, clearances, wall snapping, and resizing must use the same footprint. Preserve existing `circle` serialized shape values for compatibility; label the UI “Round / Oval.” Avoid approximations that visibly reject valid placements. Sol A owns helpers and tests; Sol B consumes them in the canvas and updates labels.

Acceptance: a 60×30 item has the correct footprint and clearance at 0°, 45°, and 90°; clicking outside the visible oval does not select it; valid wall-adjacent placement does not report a collision.

## 2. Exact keyboard nudges

Separate pointer snapping from keyboard displacement. Arrow keys apply a deterministic step without magnetic snapping; Shift increases the step. Keep grouped items' relative positions intact and retain lock checks. Document the shortcut and units in canvas help.

Acceptance: furniture flush to every wall moves away on the first arrow press; repeated presses accumulate; groups translate together.

## 3. Consistent wall locks

Introduce centralized room-change validation before accepting geometry mutations. A locked wall retains its endpoint positions, length, and existence; mutations involving shared endpoints must respect this. Cover length edits, wall translation, endpoint movement/merge/split/disconnect, removal, and drawing operations as applicable. An intentional whole-room rotation may retain its existing explicit behavior, but ordinary adjacent edits must not bypass locks. Return/display a concise actionable constraint message and identify the blocking wall.

Acceptance: sidebar, pointer, and keyboard edits cannot indirectly alter locked geometry; rejected operations do not create history entries or partial changes.

## 4. Keep wall openings valid

Validate positive feature widths and containment (`offset >= 0`, `offset + width <= wall length`) after affected geometry and feature edits. Preserve physical opening widths. Reject incompatible wall edits with an explanatory message; offer an explicit reposition-to-fit path when feasible, or clearly identify the required manual action. Ensure the sidebar never produces a negative width after a wall change.

Acceptance: shorten/drag/merge cases cannot strand doors or windows; direct width/offset edits remain valid; undo/redo restores valid states.

## 5. Preserve gallery arrangement during movement

Separate automatic relative arrangement from a shared placement translation. Add backward-compatible URL-synced translation fields defaulting to zero. Canvas movement updates translation rather than switching all rows to left alignment. A vertical or horizontal gallery move preserves every pairwise frame displacement. Reset translation when applying a new preset, and provide a visible reset-position action.

Acceptance: centered rows of different widths move as a rigid layout; existing URLs render unchanged; saved/copied URLs preserve translation.

## 6. Make automatic-layout movement effective

Apply shared translation after all distribution and furniture-alignment calculations. Define a consistent boundary policy for drag/nudge (clamp valid groups at wall bounds, with clear invalid-layout feedback). Remove accepted-but-ignored horizontal movements. Expose whole-gallery movement through a discoverable control/handle and document available shortcuts.

Acceptance: automatic distribution responds to permitted horizontal moves; blocked boundary moves have comprehensible feedback; reset restores automatic placement.

## 7. Warn about impossible frame distribution

Return structured layout validation alongside calculated positions without breaking existing calculation consumers. Detect insufficient available width and overlapping frame rectangles. Surface actionable inline warnings with required extra space. Keep invalid layouts editable while preventing instructions from presenting them as ready to hang.

Acceptance: three 50-inch frames on a 120-inch wall report the shortage and overlap; exact fits and single-frame rows remain valid; furniture bounds are handled correctly.

## 8. Validate hanging hardware

Validate finite hardware values against each effective frame size: nonnegative offsets within frame height and dual-hook insets yielding distinct hooks inside the frame. Revalidate after preset and uniform-size changes. Preserve user-entered measurements, identify affected frames, associate errors with inputs, and suppress authoritative instructions for invalid configurations.

Acceptance: a 4-inch frame with a 3-inch dual inset is flagged; below-frame hooks are flagged; mixed frame sizes identify the limiting frame; valid single/dual configurations retain correct measurements.

## 9. Complete hanging instructions

Generate a self-contained checklist per frame from computed hook coordinates. Dual hardware includes both marking/install steps and a level check. Use the selected display unit consistently; do not refer to measurements hidden on another tab. Invalid geometry/hardware shows a correction prompt instead of install instructions.

Acceptance: single and dual workflows, multiple rows, mixed sizes, and both units provide complete, correct directions.

## 10. Touch and pointer interactions

Migrate both canvases from mouse-only gestures to Pointer Events, with pointer capture and cancellation cleanup. Preserve mouse controls. One pointer selects/drags objects or pans the background; two pointers pan/pinch the viewport without committing accidental object changes. Scope touch-action suppression to the canvas so sidebars still scroll. Use larger touch hit areas for handles and provide visible access to essential actions that previously required right-click/modifiers.

Acceptance: mouse behavior remains usable; pointer cancellation leaves no stuck drag; gestures work outside the initial target under capture; pinch preserves an anchor; toolbar interaction does not start canvas dragging. Actual hardware testing is reported separately from synthetic checks.

## 11. Keyboard and screen-reader controls

Associate each dimension/rotation label with its input. Make placed-item and wall selection keyboard-operable with accessible names and selected state, without nesting action buttons inside buttons. Retain visible focus styling and add concise polite announcements for meaningful selection/movement/constraint changes. Ensure editable inputs keep their native keyboard behavior, including Undo.

Acceptance: select and edit multiple objects with keyboard alone; inputs have correct accessible names; Enter/Space activates selection; text editing does not trigger canvas shortcuts; movement announcements are not excessively noisy.

## Verification and completion

Each owner adds targeted behavioral tests for its defects and runs relevant `vp test` selections plus formatting/type checks. The lead reviews shared contracts and diffs, runs `vp check`, `vp test`, and `vp run build`, and exercises representative workflows in the local browser. Any unsupported physical-device verification is disclosed. Final changes include this plan, implementations, and meaningful regression coverage.

## Completion record — 2026-09-20

All eleven implementation items above are complete. Three Sol agents implemented their assigned scopes; the lead reviewed the integration and requested follow-up fixes for rotated ellipse support, rejected-edit history, accessible selection structure, movement announcements, drag accumulation, pinch rollback, and the touch-accessible whole-gallery movement toggle.

Final verification:

- `vp check`: passed formatting, lint, and TypeScript checks.
- `vp test`: 205 tests passed across 13 files (baseline: 177 tests).
- `vp run build`: both applications built successfully.
- Browser checks: oval footprint/clearance, named and separate item controls, keyboard movement announcements, preserved invalid hardware input and inline error, blocked invalid installation instructions, complete dual-hook coordinates, and accessible whole-gallery movement toggle.
- Automated pointer checks cover pinch anchoring/takeover, cancellation/rollback, subsequent gestures, repeated gallery movement without accumulation, and toolbar isolation.

Physical touch-device testing remains outstanding. Test/build output contains existing React-plugin esbuild deprecation notices; checks and builds pass. Changes are local and uncommitted; nothing was deployed.

## Production deployment — 2026-09-20

Deployed both applications after user authorization. Wrangler dry runs passed; existing runtime variables were preserved.

- Floor Plan: https://floor-plan.app — version `6050984c-fd47-4e0b-8bff-aca39e921a5d`.
- Hang Time: https://hang-time.app — version `eacf697d-d54f-465b-b2bb-c9b5d4df152f`.
- Both production domains return HTTP 200. Their index HTML and all referenced JavaScript/CSS assets match the verified local builds byte-for-byte (7 assets for Floor Plan, 9 for Hang Time).

Source changes remain local and uncommitted.
