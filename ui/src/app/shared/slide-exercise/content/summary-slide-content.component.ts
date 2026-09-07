import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { SlideContentComponent, SlideContentContext } from '../slide-content-contracts';
import type { SlideExerciseSummaryMetric } from '../slide-exercise.models';

interface SummarySlideData {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly metrics: readonly SlideExerciseSummaryMetric[];
}

function summaryData(value: unknown): SummarySlideData {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const metrics = Array.isArray(source['metrics']) ? source['metrics'].flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    const label = String(item['label'] ?? '').trim();
    if (!label) return [];
    return [{
      label,
      value: typeof item['value'] === 'number' ? item['value'] : String(item['value'] ?? ''),
      detail: String(item['detail'] ?? '').trim() || undefined,
    } satisfies SlideExerciseSummaryMetric];
  }) : [];
  return {
    eyebrow: String(source['eyebrow'] ?? 'Exercise complete').trim(),
    title: String(source['title'] ?? 'Nice work!').trim(),
    subtitle: String(source['subtitle'] ?? '').trim(),
    metrics,
  };
}

@Component({
  selector: 'app-summary-slide-content',
  standalone: true,
  templateUrl: './summary-slide-content.component.html',
  styleUrl: './summary-slide-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummarySlideContentComponent implements SlideContentComponent {
  readonly content = signal<SummarySlideData>({ eyebrow: 'Exercise complete', title: 'Nice work!', subtitle: '', metrics: [] });

  load(context: SlideContentContext): void {
    this.content.set(summaryData(context.data));
  }
}
