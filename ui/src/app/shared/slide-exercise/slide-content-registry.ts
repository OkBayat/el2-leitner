import type { Type } from '@angular/core';
import type { SlideContentComponent } from './slide-content-contracts';
import type { SlideExerciseChromeConfig } from './slide-exercise.models';

export type SlideContentComponentLoader = () => Promise<Type<SlideContentComponent>>;

export interface SlideContentRenderer {
  readonly type: string;
  readonly loadComponent: SlideContentComponentLoader;
  readonly chromeDefaults?: SlideExerciseChromeConfig;
}

export class SlideContentRegistry {
  private readonly renderers = new Map<string, SlideContentRenderer>();

  register(renderer: SlideContentRenderer): void {
    const type = renderer.type.trim();
    if (!type) throw new Error('Slide content renderer type is required.');
    if (this.renderers.has(type)) throw new Error(`Slide content renderer already registered: ${type}`);
    this.renderers.set(type, { ...renderer, type });
  }

  resolve(type: string): SlideContentRenderer | undefined {
    return this.renderers.get(type.trim());
  }
}

export function createDefaultSlideContentRegistry(): SlideContentRegistry {
  const registry = new SlideContentRegistry();
  registry.register({
    type: 'message',
    loadComponent: () => import('./content/message-slide-content.component')
      .then((module) => module.MessageSlideContentComponent),
  });
  registry.register({
    type: 'summary',
    chromeDefaults: { header: { visible: false } },
    loadComponent: () => import('./content/summary-slide-content.component')
      .then((module) => module.SummarySlideContentComponent),
  });
  return registry;
}
