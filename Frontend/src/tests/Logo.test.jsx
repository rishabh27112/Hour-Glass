import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Logo from '../components/Logo';

describe('Logo Component', () => {
  it('renders the logo correctly', () => {
    // 1. Render within a Router context (required for <Link>)
    render(
      <MemoryRouter>
        <Logo />
      </MemoryRouter>
    );

    // 2. Verify the Link exists and points to Home ('/')
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');

    // 3. Verify the Icon exists inside the link
    // We search specifically for the <i> tag inside the link to ensure structure
    const icon = link.querySelector('i');
    expect(icon).toBeInTheDocument();
    
    // 4. Verify specific styling classes (ensures the right icon is used)
    expect(icon).toHaveClass('ri-hourglass-line');
    expect(icon).toHaveClass('group-hover:rotate-180'); // Verifies the animation class is applied
  });
});