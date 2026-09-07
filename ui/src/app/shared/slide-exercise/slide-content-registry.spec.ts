import { describe, expect, it } from 'vitest';
import { createDefaultSlideContentRegistry, SlideContentRegistry } from './slide-content-registry';

describe('slide content registry', () => {
  it('ships only the neutral foundation renderers needed before feature-specific slide types are added', () => {
    const registry = createDefaultSlideContentRegistry();

    expect(registry.resolve('message')).toBeDefined();
    expect(registry.resolve('summary')?.chromeDefaults).toEqual({ header: { visible: false } });
    expect(registry.resolve('multiple-choice')).toBeUndefined();
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
