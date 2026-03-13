import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FLOOR_PLAN_URL, OpenFloorPlanLink } from './sidebar';

describe('OpenFloorPlanLink', () => {
  it('renders a link to the Floor Plan app', () => {
    render(<OpenFloorPlanLink />);

    expect(
      screen.getByRole('link', { name: /open floor plan/i }),
    ).toHaveAttribute('href', FLOOR_PLAN_URL);
  });
});
