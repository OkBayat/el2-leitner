import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {
  WelcomeIllustrationComponent,
  type WelcomeIllustration,
} from './welcome-illustration.component';

interface WelcomeSlide {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly detail: string;
  readonly illustration: WelcomeIllustration;
}

@Component({
  selector: 'app-welcome-page',
  imports: [MatButtonModule, WelcomeIllustrationComponent],
  templateUrl: './welcome-page.component.html',
  styleUrl: './welcome-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomePageComponent implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly welcomeTitle =
    viewChild.required<ElementRef<HTMLHeadingElement>>('welcomeTitle');

  readonly slides: readonly WelcomeSlide[] = [
    {
      eyebrow: 'Welcome to Vocora',
      title: 'Build the English you need for IELTS',
      description:
        'Vocora brings vocabulary, guided lessons, listening, and review into one calm place.',
      detail:
        'A little focused practice each day becomes progress you can see.',
      illustration: 'welcome',
    },
    {
      eyebrow: 'Your daily plan',
      title: 'Know exactly what to practice today',
      description:
        'Home keeps your next review and active course together, so you can start without planning a study session.',
      detail: 'Short, consistent sessions keep the workload realistic.',
      illustration: 'daily',
    },
    {
      eyebrow: 'Guided learning',
      title: 'Learn in context, then practise actively',
      description:
        'Learning Paths turn course material into clear lessons and interactive exercises.',
      detail:
        'Listening and focused practice help you use new language, not just recognise it.',
      illustration: 'learning',
    },
    {
      eyebrow: 'Remember for longer',
      title: 'Let the Leitner system schedule your reviews',
      description:
        'Words return when they need attention. Correct answers move forward; mistakes get focused practice.',
      detail:
        'You spend more time on what is difficult and less on what is already familiar.',
      illustration: 'leitner',
    },
    {
      eyebrow: 'Ready from day one',
      title: 'Your daily IELTS vocabulary is set up',
      description:
        'We added 1,500 IELTS words by default for your daily Leitner practice.',
      detail:
        'Vocora introduces a manageable number each day and keeps the rest ready for later.',
      illustration: 'ready',
    },
  ];

  readonly currentIndex = signal(0);
  readonly slide = computed(() => this.slides[this.currentIndex()]);
  readonly isFirst = computed(() => this.currentIndex() === 0);
  readonly isLast = computed(
    () => this.currentIndex() === this.slides.length - 1,
  );

  ngAfterViewInit(): void {
    this.welcomeTitle().nativeElement.focus();
  }

  next(): void {
    this.currentIndex.update((index) =>
      Math.min(index + 1, this.slides.length - 1),
    );
  }

  previous(): void {
    this.currentIndex.update((index) => Math.max(index - 1, 0));
  }

  goTo(index: number): void {
    if (Number.isInteger(index) && index >= 0 && index < this.slides.length) {
      this.currentIndex.set(index);
    }
  }

  async finish(): Promise<void> {
    await this.router.navigateByUrl('/dashboard');
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' && !this.isLast()) {
      event.preventDefault();
      this.next();
    } else if (event.key === 'ArrowLeft' && !this.isFirst()) {
      event.preventDefault();
      this.previous();
    }
  }
}
