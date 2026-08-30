import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThankYouScreen } from './ThankYouScreen';

describe('ThankYouScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('render-onMount-startsTranslatedOffScreen', () => {
    // The "curtain falling" entrance (2026-08-30): the container must start
    // translated fully off-screen upward, before the mount effect's
    // setTimeout flips it to its revealed position — otherwise there's
    // nothing for the transition to animate from.
    render(<ThankYouScreen onDismiss={() => {}} />);
    expect(screen.getByTestId('platformer-thank-you-screen').className).toContain('-translate-y-full');
  });

  it('afterMountTimeout-translatesIntoView', () => {
    render(<ThankYouScreen onDismiss={() => {}} />);
    act(() => {
      vi.runAllTimers();
    });
    const el = screen.getByTestId('platformer-thank-you-screen');
    expect(el.className).toContain('translate-y-0');
    expect(el.className).not.toContain('-translate-y-full');
  });

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
    expect(screen.getByTestId('platformer-thank-you-screen')).toHaveTextContent('info@pgarcia.dev');
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
