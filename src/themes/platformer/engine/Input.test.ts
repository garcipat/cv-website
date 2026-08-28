import { createKeyboardInput } from './Input';

function dispatchKey(type: 'keydown' | 'keyup', code: string): KeyboardEvent {
  const event = new KeyboardEvent(type, { code, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('createKeyboardInput', () => {
  it('isHeld-beforeAnyKeyEvent-returnsFalse', () => {
    const input = createKeyboardInput();
    expect(input.isHeld('ArrowRight')).toBe(false);
    input.destroy();
  });

  it('keydown-forTrackedCode-marksItHeld', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'ArrowRight');
    expect(input.isHeld('ArrowRight')).toBe(true);
    input.destroy();
  });

  it('keyup-afterKeydown-marksItNotHeld', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'ArrowRight');
    dispatchKey('keyup', 'ArrowRight');
    expect(input.isHeld('ArrowRight')).toBe(false);
    input.destroy();
  });

  it('keydown-repeatedForSameCode-staysHeldUntilKeyup', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'ArrowRight');
    dispatchKey('keydown', 'ArrowRight'); // OS key-repeat while held
    expect(input.isHeld('ArrowRight')).toBe(true);
    input.destroy();
  });

  it('keydown-forGameKey-preventsDefault', () => {
    const input = createKeyboardInput();
    const event = dispatchKey('keydown', 'ArrowLeft');
    expect(event.defaultPrevented).toBe(true);
    input.destroy();
  });

  it('keydown-forArrowDown-preventsDefault', () => {
    const input = createKeyboardInput();
    const event = dispatchKey('keydown', 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    input.destroy();
  });

  it('keydown-forKeyS-preventsDefault', () => {
    const input = createKeyboardInput();
    const event = dispatchKey('keydown', 'KeyS');
    expect(event.defaultPrevented).toBe(true);
    input.destroy();
  });

  it('keydown-forNonGameKey-doesNotPreventDefaultButStillTracksHeld', () => {
    const input = createKeyboardInput();
    const event = dispatchKey('keydown', 'KeyJ');
    expect(event.defaultPrevented).toBe(false);
    expect(input.isHeld('KeyJ')).toBe(true);
    input.destroy();
  });

  it('destroy-afterCalled-stopsTrackingFurtherKeyEvents', () => {
    const input = createKeyboardInput();
    input.destroy();
    dispatchKey('keydown', 'ArrowRight');
    expect(input.isHeld('ArrowRight')).toBe(false);
  });

  it('consumePress-beforeAnyKeyEvent-returnsFalse', () => {
    const input = createKeyboardInput();
    expect(input.consumePress('Space')).toBe(false);
    input.destroy();
  });

  it('consumePress-afterKeydown-returnsTrueOnce', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    expect(input.consumePress('Space')).toBe(true);
    expect(input.consumePress('Space')).toBe(false);
    input.destroy();
  });

  it('consumePress-afterOsAutoRepeatKeydown-doesNotRefireOnceConsumed', () => {
    const input = createKeyboardInput();
    const first = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    window.dispatchEvent(first);
    expect(input.consumePress('Space')).toBe(true);

    const repeat = new KeyboardEvent('keydown', { code: 'Space', cancelable: true, repeat: true });
    window.dispatchEvent(repeat);
    expect(input.consumePress('Space')).toBe(false);
    input.destroy();
  });

  it('consumePress-afterKeyupThenKeydownAgain-returnsTrueForTheNewPress', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    expect(input.consumePress('Space')).toBe(true);
    dispatchKey('keyup', 'Space');
    dispatchKey('keydown', 'Space');
    expect(input.consumePress('Space')).toBe(true);
    input.destroy();
  });

  it('destroy-afterCalled-clearsPendingPresses', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    input.destroy();
    expect(input.consumePress('Space')).toBe(false);
  });

  it('clearPending-afterPendingKeydown-consumePressReturnsFalse', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    input.clearPending();
    expect(input.consumePress('Space')).toBe(false);
    input.destroy();
  });

  it('clearPending-whileKeyHeld-doesNotAffectIsHeld', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    input.clearPending();
    expect(input.isHeld('Space')).toBe(true);
    input.destroy();
  });
});
