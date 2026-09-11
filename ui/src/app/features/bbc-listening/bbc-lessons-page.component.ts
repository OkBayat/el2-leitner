import { listeningDifficultyLabel, listeningLevelLabel } from '../../domain/listening-practice/listening-practice';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VocoButtonComponent } from '../../shared/voco-button';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import { ListeningLessonSummary } from '../../domain/listening-practice/listening-practice';

@Component({
  selector: 'app-bbc-lessons-page',
  imports: [DatePipe, RouterLink, VocoButtonComponent],
  templateUrl: 'bbc-lessons-page.component.html',
  styleUrl: 'bbc-lessons-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbcLessonsPageComponent implements OnInit {
  readonly levelLabel = listeningLevelLabel;
  readonly difficultyLabel = listeningDifficultyLabel;
  private readonly api = inject(ListeningPracticeApiService);

  readonly lessons = signal<ListeningLessonSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await this.api.listBbcLessons();
      this.lessons.set(response.lessons);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'The BBC lessons could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
}
