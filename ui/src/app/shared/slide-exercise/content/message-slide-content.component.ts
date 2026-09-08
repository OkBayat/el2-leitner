import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { SlideContentComponent, SlideContentContext } from '../slide-content-contracts';

interface MessageSlideData {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
}

function messageData(value: unknown): MessageSlideData {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    eyebrow: String(source['eyebrow'] ?? '').trim(),
    title: String(source['title'] ?? '').trim(),
    body: String(source['body'] ?? '').trim(),
  };
}

@Component({
  selector: 'app-message-slide-content',
  standalone: true,
  templateUrl: './message-slide-content.component.html',
  styleUrl: './message-slide-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageSlideContentComponent implements SlideContentComponent {
  readonly content = signal<MessageSlideData>({ eyebrow: '', title: '', body: '' });

  load(context: SlideContentContext): void {
    this.content.set(messageData(context.data));
  }
}
