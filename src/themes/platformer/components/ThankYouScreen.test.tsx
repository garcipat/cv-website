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
    // doubly-nested requestAnimationFrame flips it to its revealed position
    // — otherwise there's nothing for the transition to animate from.
    render(<ThankYouScreen onDismiss={() => {}} />);
    expect(screen.getByTestId('platformer-thank-you-screen').className).toContain('-translate-y-full');
  });

  it('afterOneAnimationFrame-staysOffScreen-onlyFlipsAfterTheSecond', () => {
    // Regression coverage (final review, Important 1): a SINGLE rAF isn't
    // enough — the callback can still run before the browser's first paint,
    // so the flip must wait for a second, nested rAF. Advancing exactly one
    // frame must NOT yet reveal the screen; only advancing a second one does.
    render(<ThankYouScreen onDismiss={() => {}} />);
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(screen.getByTestId('platformer-thank-you-screen').className).toContain('-translate-y-full');

    act(() => {
      vi.advanceTimersToNextFrame();
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

  it('render-does-notShowContactWebsite', () => {
    // D8: contact.website is redundant with email/GitHub/LinkedIn and was
    // dropped entirely — real cv.en.json's contact.website is
    // 'https://pgarcia.dev', which must not appear anywhere on the screen.
    render(<ThankYouScreen onDismiss={() => {}} />);
    expect(screen.queryByText('https://pgarcia.dev')).not.toBeInTheDocument();
  });

  it('render-showsLinkedinAndGithub-asRealClickableLinks', () => {
    // D8: LinkedIn/GitHub are URLs meant to be followed, so they render as
    // real target="_blank" anchors (with the required rel="noopener
    // noreferrer"), unlike the plain-text email/phone/location lines.
    render(<ThankYouScreen onDismiss={() => {}} />);
    const linkedinLink = screen.getByRole('link', { name: 'https://www.linkedin.com/in/garcipat/en-US' });
    expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/garcipat/en-US');
    expect(linkedinLink).toHaveAttribute('target', '_blank');
    expect(linkedinLink).toHaveAttribute('rel', 'noopener noreferrer');

    const githubLink = screen.getByRole('link', { name: 'https://github.com/garcipat' });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/garcipat');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
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
