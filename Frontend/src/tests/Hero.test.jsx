import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Hero from '../components/Hero';

describe('Hero Component', () => {
  it('renders all hero content and navigation correctly', () => {
    // We must wrap in MemoryRouter because Hero uses the <Link> component
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    // 1. Verify Main Headline
    // Using regex /i for case-insensitive matching helps robustness
    expect(screen.getByText(/Streamline Your Workday with/i)).toBeInTheDocument();
    expect(screen.getByText(/Effortless Time Tracking/i)).toBeInTheDocument();

    // 2. Verify Sub-headline
    expect(screen.getByText(/Track, manage, and optimize your team's time/i)).toBeInTheDocument();

    // 3. Verify Button Text
    expect(screen.getByText(/Start tracking for free/i)).toBeInTheDocument();

    // 4. Verify Link Navigation
    // We look for the link (anchor tag) that wraps the button
    const linkElement = screen.getByRole('link', { name: /Start tracking for free/i });
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', '/signup');

    // 5. Verify visual elements (like the Remix Icon class) exists
    // We check if the <i> tag with the specific class is rendered
    const arrowIcon = screen.getByRole('link').querySelector('i');
    expect(arrowIcon).toHaveClass('ri-arrow-right-line');
  });
});