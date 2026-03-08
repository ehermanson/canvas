import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpenRoomPlanLink, ROOM_PLAN_URL } from './sidebar';

describe('OpenRoomPlanLink', () => {
  it('renders a link to the Room Plan app', () => {
    render(<OpenRoomPlanLink />);

    expect(
      screen.getByRole('link', { name: /open room plan/i }),
    ).toHaveAttribute('href', ROOM_PLAN_URL);
  });
});
