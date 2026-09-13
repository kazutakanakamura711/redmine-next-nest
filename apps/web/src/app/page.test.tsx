import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home', () => {
  it('shows the local development endpoints', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '開発環境を準備しました',
    );
    expect(screen.getByText(/localhost:3001\/api\/health/)).toBeInTheDocument();
  });
});
