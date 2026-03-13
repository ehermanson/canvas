import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HANG_TIME_URL, OpenHangTimeLink } from './sidebar';

describe('OpenHangTimeLink', () => {
  it('renders a link to the Hang Time app', () => {
    render(<OpenHangTimeLink />);

    expect(
      screen.getByRole('link', { name: /open hang time/i }),
    ).toHaveAttribute('href', HANG_TIME_URL);
  });
});
