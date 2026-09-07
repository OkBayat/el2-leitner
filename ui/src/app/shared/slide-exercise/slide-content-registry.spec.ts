import { describe, expect, it } from 'vitest';
import { REUSABLE_SLIDE_TYPES } from './library/slide-library.models';
import { createDefaultSlideContentRegistry, SlideContentRegistry } from './slide-content-registry';

describe('slide content registry', () => {
  it('ships the shared renderers currently owned by the slide exercise foundation', () => {
    const registry = createDefaultSlideContentRegistry();

    expect(registry.resolve('message')).toBeDefined();
    expect(registry.resolve('summary')?.chromeDefaults).toEqual({ header: { visible: false } });
    expect(registry.resolve('choice')?.chromeDefaults).toEqual({
      footer: {
        primary: { id: 'check', label: 'Check', behavior: 'content', disabled: true },
      },
    });
    expect(REUSABLE_SLIDE_TYPES.every((type) => registry.resolve(type))).toBe(true);
    expect(registry.registeredTypes()).toHaveLength(REUSABLE_SLIDE_TYPES.length + 2);
  });

  it('rejects duplicate renderer ownership for the same slide type', () => {
    const registry = new SlideContentRegistry();
    const renderer = {
      type: 'custom',
      loadComponent: async () => { throw new Error('not loaded in this test'); },
    };
    registry.register(renderer);

    expect(() => registry.register(renderer)).toThrow('Slide content renderer already registered: custom');
  });
});
