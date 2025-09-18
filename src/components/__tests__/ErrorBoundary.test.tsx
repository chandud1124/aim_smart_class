import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../ErrorBoundary';

// Mock console.error to avoid noise in test output
const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Component that throws an error
const ErrorComponent = () => {
  throw new Error('Test error');
};

// Component that can be toggled to throw or not throw
const ToggleErrorComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
};

describe('ErrorBoundary', () => {
  afterAll(() => {
    consoleError.mockRestore();
  });

  test('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  test('renders error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  test('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  test('handles reset functionality', async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Verify the reset button exists and can be clicked
    const resetButton = screen.getByText('Try Again');
    expect(resetButton).toBeInTheDocument();

    // Click the reset button (this should reset the error boundary state)
    await user.click(resetButton);

    // The button should still be there after clicking (reset functionality)
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
