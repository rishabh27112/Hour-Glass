import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NavLogo from '../components/NavLogo'; // Ensure this path is correct

describe('NavLogo Component', () => {
  it('renders the logo link and icon correctly', () => {
    // 1. Wrap in MemoryRouter because it uses <Link>
    render(
      <MemoryRouter>
        <NavLogo />
      </MemoryRouter>
    );

    // 2. Verify the Link component
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');

    // 3. Verify the Icon structure
    // We specifically look for the <i> tag inside the link
    const icon = link.querySelector('i');
    expect(icon).toBeInTheDocument();

    // 4. Verify Styling Classes
    // This checks that the specific Remix Icon class is present
    expect(icon).toHaveClass('ri-hourglass-line');
    
    // This checks the hover animation class matches your code
    expect(icon).toHaveClass('group-hover:rotate-180');
    
    // (Optional) Check size class to distinguish from the other Logo component
    expect(icon).toHaveClass('text-4xl');
  });
});