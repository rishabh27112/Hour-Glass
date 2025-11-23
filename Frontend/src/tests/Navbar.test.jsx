import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/Navbar'; 

vi.mock('../components/Logo', () => ({
  default: () => <div data-testid="mock-logo">Logo</div>
}));

describe('Navbar Component', () => {
  it('renders desktop content correctly (Logo, Title, Desktop Links)', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    // Now this will pass because the mock is correctly applied
    expect(screen.getByTestId('mock-logo')).toBeInTheDocument();
    
    expect(screen.getByText('Hour Glass')).toBeInTheDocument();

    const loginLink = screen.getByRole('link', { name: /Log In/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');

    const homeLink = screen.getByRole('link', { name: /Home/i });
    expect(homeLink).toBeInTheDocument();

    const aboutLink = screen.getByRole('link', { name: /About Us/i });
    expect(aboutLink).toBeInTheDocument();
  });

  it('mobile menu is hidden by default', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    const mobileSignIn = screen.queryByRole('link', { name: /Sign In/i });
    expect(mobileSignIn).not.toBeInTheDocument();
  });

  it('toggles mobile menu when hamburger button is clicked', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    const toggleButton = screen.getByRole('button');

    // Open Menu
    fireEvent.click(toggleButton);

    const mobileSignIn = screen.getByRole('link', { name: /Sign In/i });
    expect(mobileSignIn).toBeInTheDocument();
    expect(mobileSignIn).toHaveAttribute('href', '/signin');

    // Close Menu
    fireEvent.click(toggleButton);

    expect(screen.queryByRole('link', { name: /Sign In/i })).not.toBeInTheDocument();
  });

  it('renders correct icons based on state (Menu vs X)', () => {
    const { container } = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton.querySelector('svg')).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(toggleButton.querySelector('svg')).toBeInTheDocument();
  });
});