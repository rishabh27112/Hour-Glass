import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../pages/HomePage';
import React from 'react';
// 1. Mock the child components
// We mock these to ensure we are testing HomePage in isolation.
// We replace the complex children with simple dummy elements that are easy to find.
vi.mock('../components/Navbar', () => ({
  default: () => <div data-testid="navbar-mock">Navbar Component</div>,
}));

vi.mock('../components/Hero', () => ({
  default: () => <div data-testid="hero-mock">Hero Component</div>,
}));

vi.mock('../components/HowItWorks', () => ({
  default: () => <div data-testid="how-it-works-mock">HowItWorks Component</div>,
}));

describe('HomePage Component', () => {
  it('renders the HomePage container with correct classes', () => {
    const { container } = render(<HomePage />);
    
    // Check if the main wrapper div exists and has the correct styling classes
    // .firstChild accesses the outer <div>
    expect(container.firstChild).toHaveClass('antialiased');
    expect(container.firstChild).toHaveClass('tracking-wide');
  });

  it('renders all child components (Navbar, Hero, HowItWorks)', () => {
    render(<HomePage />);

    // Check if Navbar is present
    expect(screen.getByTestId('navbar-mock')).toBeInTheDocument();
    expect(screen.getByText('Navbar Component')).toBeInTheDocument();

    // Check if Hero is present
    expect(screen.getByTestId('hero-mock')).toBeInTheDocument();
    expect(screen.getByText('Hero Component')).toBeInTheDocument();

    // Check if HowItWorks is present
    expect(screen.getByTestId('how-it-works-mock')).toBeInTheDocument();
    expect(screen.getByText('HowItWorks Component')).toBeInTheDocument();
  });
});
