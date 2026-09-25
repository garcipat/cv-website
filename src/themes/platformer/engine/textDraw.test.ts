import { describe, expect, it } from 'vitest';
import { fillTextWithOutline, RESTART_PROMPT_FONT_FAMILY } from './textDraw';

interface TextCall {
  text: string;
  x: number;
  y: number;
  fillStyle: string;
}

const fakeCtx = (): { ctx: CanvasRenderingContext2D; calls: TextCall[] } => {
  const calls: TextCall[] = [];
  const ctx = {
    fillStyle: '#fff' as string,
    fillText(text: string, x: number, y: number): void {
      calls.push({ text, x, y, fillStyle: ctx.fillStyle });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
};

describe('RESTART_PROMPT_FONT_FAMILY', () => {
  it('isTheSharedPixelFontFamily', () => {
    expect(RESTART_PROMPT_FONT_FAMILY).toBe('ByteBounce');
  });
});

describe('fillTextWithOutline', () => {
  it('drawsFourOutlineStrokesThenTheFillWithTheCallersFillStyle', () => {
    const { ctx, calls } = fakeCtx();
    ctx.fillStyle = '#fff';

    fillTextWithOutline(ctx, 'Hi', 10, 20);

    expect(calls).toHaveLength(5);
    expect(calls.map((call) => [call.x, call.y])).toEqual([
      [9, 19],
      [11, 19],
      [9, 21],
      [11, 21],
      [10, 20],
    ]);
    expect(calls.slice(0, 4).every((call) => call.fillStyle === 'rgba(0,0,0,0.8)')).toBe(true);
    expect(calls[4].fillStyle).toBe('#fff');
    expect(calls.every((call) => call.text === 'Hi')).toBe(true);
  });

  it('restoresTheCallersFillStyleAfterDrawing', () => {
    const { ctx } = fakeCtx();
    ctx.fillStyle = '#abcdef';

    fillTextWithOutline(ctx, 'x', 0, 0);

    expect(ctx.fillStyle).toBe('#abcdef');
  });
});
