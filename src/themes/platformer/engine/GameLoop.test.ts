import { createGameLoop } from './GameLoop';

describe('createGameLoop', () => {
  let frameCallback: FrameRequestCallback | null = null;
  let rafSpy: ReturnType<typeof vi.fn>;
  let cafSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    frameCallback = null;
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    cafSpy = vi.fn();
    vi.stubGlobal('requestAnimationFrame', rafSpy);
    vi.stubGlobal('cancelAnimationFrame', cafSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('start-called-schedulesFirstAnimationFrame', () => {
    createGameLoop(() => {}).start();
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('start-firstFrameFires-doesNotCallOnTickYet', () => {
    const onTick = vi.fn();
    createGameLoop(onTick).start();
    frameCallback!(0);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('start-secondFrameFires-callsOnTickWithElapsedSecondsSincePreviousFrame', () => {
    const onTick = vi.fn();
    createGameLoop(onTick).start();
    frameCallback!(0);
    frameCallback!(16);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith(0.016);
  });

  it('tick-elapsedExceedsCap-clampsDtToMax', () => {
    const onTick = vi.fn();
    createGameLoop(onTick).start();
    frameCallback!(0);
    frameCallback!(1000); // huge gap, e.g. the tab was backgrounded
    expect(onTick).toHaveBeenCalledWith(1 / 30);
  });

  it('stop-afterStart-cancelsTheScheduledFrame', () => {
    const loop = createGameLoop(() => {});
    loop.start();
    loop.stop();
    expect(cafSpy).toHaveBeenCalledWith(1);
  });

  it('start-calledTwiceWithoutStop-onlySchedulesOnce', () => {
    const loop = createGameLoop(() => {});
    loop.start();
    loop.start();
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });
});
