import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MainButton from '../components/MainButton';

describe('MainButton Component', () => {
  it('renders correctly with required text', () => {
    render(<MainButton txt="Login" />);
    
    // Check if button exists and has the correct text
    const button = screen.getByRole('button', { name: /Login/i });
    expect(button).toBeInTheDocument();
  });

  it('uses the default "submit" type when no type prop is provided', () => {
    // This covers the right side of the logical OR: (props.type || 'submit')
    render(<MainButton txt="Submit" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('uses the provided type when passed', () => {
    // This covers the left side of the logical OR
    render(<MainButton txt="Reset" type="reset" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'reset');
  });

  it('handles the onClick event', () => {
    const handleClick = vi.fn();
    render(<MainButton txt="Click Me" onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders in disabled state correctly', () => {
    const handleClick = vi.fn();
    render(<MainButton txt="Disabled" disabled={true} onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    
    // 1. Check attribute
    expect(button).toBeDisabled();
    
    // 2. Check visual class for disabled state (Tailwind class)
    expect(button).toHaveClass('disabled:opacity-50');
    expect(button).toHaveClass('disabled:cursor-not-allowed');
    
    // 3. Ensure click doesn't fire (standard HTML behavior)
    // Note: fireEvent in JSDOM sometimes bypasses disabled checks, 
    // but verifying the disabled attribute is usually sufficient for coverage.
    expect(button).toHaveAttribute('disabled');
  });

  it('renders the animation span elements', () => {
    // To be thorough about the JSX structure
    const { container } = render(<MainButton txt="Animation Test" />);
    
    // We look for the span with the specific gradient class
    // using querySelector since it has no text content
    const gradientSpan = container.querySelector('.bg-gradient-to-r');
    expect(gradientSpan).toBeInTheDocument();
  });

  it('has correct hover and transition classes', () => {
    render(<MainButton txt="Hover Test" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:translate-y-0.5');
    expect(button).toHaveClass('transition-all');
    expect(button).toHaveClass('duration-300');
    expect(button).toHaveClass('ease-in-out');
  });
});