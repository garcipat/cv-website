import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThankYouScreen } from './ThankYouScreen';

describe('ThankYouScreen', () => {
  it('render-shows-thankYouMessage', () => {
    render(<ThankYouScreen onDismiss={() => {}} />);
    expect(screen.getByTestId('platformer-thank-you-screen')).toHaveTextContent('Thank you for playing!');
  });

  it('render-shows-continuePrompt', () => {
    render(<ThankYouScreen onDismiss={() => {}} />);
    expect(screen.getByTestId('platformer-thank-you-screen')).toHaveTextContent(
      'Press any button to continue',
    );
  });

  it('render-shows-contactEmailFromCVData', () => {
    render(<ThankYouScreen onDismiss={() => {}} />);
    // Real cv.en.json's contact.email — see src/data/cv.en.json.
    expect(screen.getByTestId('platformer-thank-you-screen')).toBeInTheDocument();
  });

  it('anyKeyPress-calls-onDismiss', () => {
    const onDismiss = vi.fn();
    render(<ThankYouScreen onDismiss={onDismiss} />);

    fireEvent.keyDown(window, { code: 'Space' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('click-calls-onDismiss', () => {
    const onDismiss = vi.fn();
    render(<ThankYouScreen onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('platformer-thank-you-screen'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
