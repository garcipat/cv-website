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
});
