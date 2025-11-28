import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

// Mock all page components to avoid rendering the full tree
vi.mock('../pages/HomePage', () => ({ default: () => <div data-testid="home-page">Home Page</div> }));
vi.mock('../pages/LoginPage', () => ({ default: () => <div data-testid="login-page">Login Page</div> }));
vi.mock('../pages/SignUpPage', () => ({ default: () => <div data-testid="signup-page">Sign Up Page</div> }));
vi.mock('../pages/ForgotPasswordPage', () => ({ default: () => <div data-testid="forgot-password-page">Forgot Password Page</div> }));
vi.mock('../pages/ProfilePage', () => ({ default: () => <div data-testid="profile-page">Profile Page</div> }));
vi.mock('../pages/Dashboard', () => ({ default: () => <div data-testid="dashboard-page">Dashboard Page</div> }));
vi.mock('../pages/ArchivePage', () => ({ default: () => <div data-testid="archive-page">Archive Page</div> }));
vi.mock('../pages/BinPage', () => ({ default: () => <div data-testid="bin-page">Bin Page</div> }));
vi.mock('../pages/ProjectPage', () => ({ default: () => <div data-testid="project-page">Project Page</div> }));
vi.mock('../pages/Tasks/TaskPage', () => ({ default: () => <div data-testid="task-page">Task Page</div> }));
vi.mock('../pages/AI_Summary/AI_Summary_Page', () => ({ default: () => <div data-testid="ai-summary-page">AI Summary Page</div> }));
vi.mock('../pages/Project_Summary/Project_Summary_Page', () => ({ default: () => <div data-testid="project-summary-page">Project Summary Page</div> }));

describe('App Component', () => {
  it('renders the Home Page by default', () => {
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('renders the Login Page on /login', () => {
    window.location.hash = '#/login';
    render(<App />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders the Sign Up Page on /signup', () => {
    window.location.hash = '#/signup';
    render(<App />);
    expect(screen.getByTestId('signup-page')).toBeInTheDocument();
  });

  it('redirects unknown routes to Home Page', () => {
    window.location.hash = '#/some-random-route';
    render(<App />);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });
});
