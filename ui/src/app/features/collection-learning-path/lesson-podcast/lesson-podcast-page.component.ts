import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CollectionLearningPathApiService } from '../../../core/collection-learning-path/collection-learning-path-api.service';
import { LearningPathPodcastCatalogService } from '../../../core/collection-learning-path/learning-path-podcast-catalog.service';
import type { LearningPathLessonView } from '../../../domain/collection-learning-path/learning-path';
import { ListeningAudioPlayerComponent } from '../../../shared/listening-audio-player/listening-audio-player.component';

interface LessonPodcastRoute {
  pathId: string;
  lessonId: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'The lesson audio could not be loaded.';
}

@Component({
  selector: 'app-learning-path-lesson-podcast-page',
  standalone: true,
  imports: [MatButtonModule, RouterLink, ListeningAudioPlayerComponent],
  templateUrl: './lesson-podcast-page.component.html',
  styleUrl: './lesson-podcast-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonPodcastPageComponent {
  private readonly api = inject(CollectionLearningPathApiService);
  private readonly catalog = inject(LearningPathPodcastCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private requestVersion = 0;
  private readonly routeState = signal<LessonPodcastRoute | null>(null);

  readonly pathId = signal('');
  readonly lesson = signal<LearningPathLessonView | null>(null);
  readonly audioSrc = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const state = {
        pathId: params.get('pathId')?.trim() ?? '',
        lessonId: params.get('lessonId')?.trim() ?? '',
      };
      this.routeState.set(state);
      this.pathId.set(state.pathId);
      if (state.pathId && state.lessonId) void this.load(state);
    });
  }

  retry(): void {
    const state = this.routeState();
    if (state) void this.load(state);
  }

  private async load(state: LessonPodcastRoute): Promise<void> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    this.lesson.set(null);
    this.audioSrc.set('');

    try {
      const view = await this.api.queryLearningPath(state.pathId);
      const lesson = view.lessons.find((candidate) => candidate.id === state.lessonId);
      if (!lesson) throw new Error('The requested lesson is not available.');
      const managedLessonId = await this.catalog.resolveLessonId(view.path.collectionId, {
        position: lesson.position,
        title: lesson.title,
      });
      if (request !== this.requestVersion) return;
      this.lesson.set(lesson);
      this.audioSrc.set(`/data/learning-path-podcasts/${encodeURIComponent(managedLessonId)}.m4a`);
    } catch (error) {
      if (request === this.requestVersion) this.error.set(errorMessage(error));
    } finally {
      if (request === this.requestVersion) this.loading.set(false);
    }
  }
}
