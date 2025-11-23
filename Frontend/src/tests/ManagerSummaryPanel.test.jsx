import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ManagerSummaryPanel from '../pages/AI_Summary/ManagerSummaryPanel';

// --- MOCK DATA ---

const MOCK_DATE = '2023-10-27T10:00:00Z';

// Shape 1: GET /ai-summary/manager (Nested inside summary object)
const DATA_SHAPE_GET = {
  summary: {
    managerSummary: 'Overall team performance was good.',
    reports: [
      { username: 'Alice', itemsCount: 5, summary: 'Fixed bugs.' },
      { username: 'Bob', itemsCount: 2, summary: 'Client meeting.' }
    ],
    date: MOCK_DATE,
    managerUsername: 'Manager Mike'
  }
};

// Shape 2: POST /daily-summary/manager (Flat structure)
const DATA_SHAPE_POST = {
  managerSummary: 'Team focused on deadlines.',
  reports: [
    { username: 'Charlie', itemsCount: 8, summary: 'Deployed features.' }
  ],
  date: MOCK_DATE,
  managerUsername: 'Manager Mike'
};

// Shape 3: Fallback / Minimal
const DATA_SHAPE_FALLBACK = {
  managerSummary: 'Simple summary text.', 
  reports: [],
  // no date, no manager name
};

describe('ManagerSummaryPanel Component', () => {

  it('renders nothing if data is null', () => {
    const { container } = render(<ManagerSummaryPanel data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders correctly with GET response shape', () => {
    render(<ManagerSummaryPanel data={DATA_SHAPE_GET} />);

    expect(screen.getByText('Manager Mike')).toBeInTheDocument();
    expect(screen.getByText(new Date(MOCK_DATE).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Overall team performance was good.')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Fixed bugs.')).toBeInTheDocument();
    expect(screen.getByText('Items: 5')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Client meeting.')).toBeInTheDocument();
  });

  it('renders correctly with POST response shape', () => {
    render(<ManagerSummaryPanel data={DATA_SHAPE_POST} />);

    expect(screen.getByText('Team focused on deadlines.')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Items: 8')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders correctly with Fallback/Minimal shape', () => {
    render(<ManagerSummaryPanel data={DATA_SHAPE_FALLBACK} />);

    // Check for Manager label/fallback
    const managerElements = screen.getAllByText('Manager');
    expect(managerElements.length).toBeGreaterThanOrEqual(2);
    
    // Now this will work because we used managerSummary in the mock data
    expect(screen.getByText('Simple summary text.')).toBeInTheDocument();

    expect(screen.getByText('No member reports available.')).toBeInTheDocument();
  });

  it('handles missing summary text gracefully', () => {
    const data = { ...DATA_SHAPE_POST, managerSummary: '' };
    render(<ManagerSummaryPanel data={data} />);

    expect(screen.getByText('No summary text returned from server.')).toBeInTheDocument();
  });

  it('handles member reports with missing fields', () => {
    const data = {
      managerSummary: 'Test',
      reports: [
        { user: 'Dave' } 
      ]
    };
    render(<ManagerSummaryPanel data={data} />);

    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.getByText('Items: 0')).toBeInTheDocument(); 
    expect(screen.getByText('No recorded activity.')).toBeInTheDocument();
  });

  it('renders items count label correctly', () => {
    const data = {
      reports: [
        { username: 'User1', itemsCount: 10 }, 
        { username: 'User2', itemsCount: 0 }   
      ]
    };
    render(<ManagerSummaryPanel data={data} />);

    expect(screen.getByText('10 activities')).toBeInTheDocument();
    expect(screen.getByText('No activity')).toBeInTheDocument();
  });
});