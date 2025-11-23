import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HowItWorks from '../components/HowItWorks';

describe('HowItWorks Component', () => {
  it('renders the main headline correctly', () => {
    render(<HowItWorks />);
    // Verify the main H2 title exists
    expect(screen.getByText(/Get started in 3 simple steps/i)).toBeInTheDocument();
  });

  it('renders the correct number of steps (loop execution)', () => {
    render(<HowItWorks />);
    
    // We expect the static description to appear 3 times (once for each card)
    const descriptions = screen.getAllByText(/A short description of this simple step goes here/i);
    expect(descriptions).toHaveLength(3);
  });

  it('renders specific titles for each step', () => {
    render(<HowItWorks />);
    
    const expectedTitles = [
      '1. Start Your Timer',
      '2. Visualize Your Day',
      '3. Generate Reports'
    ];

    // Ensure every title from the array is actually in the document
    expectedTitles.forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('renders the icons (SVGs)', () => {
    const { container } = render(<HowItWorks />);
    
    // React Icons render as <svg> tags. 
    // We verify 3 SVGs exist to ensure the icon prop was passed and rendered correctly.
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(3);
  });
});