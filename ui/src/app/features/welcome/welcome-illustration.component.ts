import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type WelcomeIllustration =
  'welcome' | 'daily' | 'learning' | 'leitner' | 'ready';

@Component({
  selector: 'app-welcome-illustration',
  templateUrl: './welcome-illustration.component.html',
  styleUrl: './welcome-illustration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeIllustrationComponent {
  readonly kind = input.required<WelcomeIllustration>();
}
