import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Logo from './Logo';

describe('Logo Component', () => {
  const renderLogo = () => {
    return render(
      <MemoryRouter>
        <Logo />
      </MemoryRouter>
    );
  };

  it('should render without crashing', () => {
    renderLogo();
    const logoIcon = screen.getByRole('link');
    expect(logoIcon).toBeInTheDocument();
  });

  it('should link to home page', () => {
    renderLogo();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/');
  });

  it('should contain hourglass icon', () => {
    renderLogo();
    const icon = document.querySelector('.ri-hourglass-line');
    expect(icon).toBeInTheDocument();
  });

  it('should have cyan color class', () => {
    renderLogo();
    const icon = document.querySelector('.ri-hourglass-line');
    expect(icon).toHaveClass('text-[#18d4d1]');
  });

  it('should have group class for hover effects', () => {
    renderLogo();
    const container = document.querySelector('.group');
    expect(container).toBeInTheDocument();
  });
});
