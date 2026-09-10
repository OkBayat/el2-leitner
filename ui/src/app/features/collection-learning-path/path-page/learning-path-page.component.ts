import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CollectionLearningPathFacade } from '../../../application/collection-learning-path/collection-learning-path.facade';
import {
  isCanonicalLearningPathPublicId,
  learningPathStateLabel,
  learningPathStartExerciseId,
  type LearningPathExerciseSelection,
} from '../../../domain/collection-learning-path/learning-path';
import { lessonTrailPalette } from '../components/lesson-palette';
import { LessonNodeComponent } from '../components/lesson-node/lesson-node.component';
import { ProgressHeaderComponent } from '../components/progress-header/progress-header.component';

const LESSON_BATCH_SIZE = 40;

@Component({
  selector: 'app-learning-path-page',
  standalone: true,
  imports: [RouterLink, ProgressHeaderComponent, LessonNodeComponent],
  templateUrl: './learning-path-page.component.html',
  styleUrl: './learning-path-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningPathPageComponent {
  readonly facade = inject(CollectionLearningPathFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly collectionId = signal('');
  readonly pathId = signal('');
  readonly currentLessonId = signal('');
  readonly requestedVisibleLessonCount = signal(LESSON_BATCH_SIZE);
  readonly visibleLessonCount = computed(() => {
    const view = this.facade.view();
    if (!view) return this.requestedVisibleLessonCount();
    const resumeLessonId = view.resumePoint?.lessonId;
    const resumeIndex = resumeLessonId
      ? view.lessons.findIndex((lesson) => lesson.id === resumeLessonId)
      : -1;
    const resumeBatchEnd = resumeIndex < 0
      ? 0
      : Math.ceil((resumeIndex + 1) / LESSON_BATCH_SIZE) * LESSON_BATCH_SIZE;
    return Math.min(
      view.lessons.length,
      Math.max(this.requestedVisibleLessonCount(), resumeBatchEnd),
    );
  });
  readonly visibleLessons = computed(() => this.facade.view()?.lessons.slice(0, this.visibleLessonCount()) ?? []);
  readonly currentLesson = computed(() => {
    const lessons = this.visibleLessons();
    return lessons.find((lesson) => lesson.id === this.currentLessonId()) ?? lessons[0] ?? null;
  });
  readonly currentLessonStateLabel = computed(() => {
    const lesson = this.currentLesson();
    return lesson ? learningPathStateLabel(lesson.state) : '';
  });
  readonly currentLessonPalette = computed(() => lessonTrailPalette(this.currentLesson()?.position ?? 1));
  readonly startExerciseId = computed(() => learningPathStartExerciseId(this.facade.view()?.lessons ?? []));
  readonly remainingLessonCount = computed(() => Math.max(
    0,
    (this.facade.view()?.lessons.length ?? 0) - this.visibleLessonCount(),
  ));
  readonly nextLessonBatchSize = computed(() => Math.min(LESSON_BATCH_SIZE, this.remainingLessonCount()));

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const collectionId = params.get('collectionId')?.trim() ?? '';
      const pathId = params.get('pathId')?.trim() ?? '';
      this.collectionId.set(collectionId);
      this.pathId.set(pathId);
      this.requestedVisibleLessonCount.set(LESSON_BATCH_SIZE);
      if (pathId) void this.facade.loadByPathId(pathId);
      else if (collectionId) void this.loadLegacyCollectionRoute(collectionId);
    });
  }

  retry(): void {
    if (this.pathId()) void this.facade.loadByPathId(this.pathId());
    else if (this.collectionId()) void this.loadLegacyCollectionRoute(this.collectionId());
  }

  showMoreLessons(): void {
    const total = this.facade.view()?.lessons.length ?? 0;
    this.requestedVisibleLessonCount.set(Math.min(total, this.visibleLessonCount() + LESSON_BATCH_SIZE));
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  syncCurrentLessonHeader(): void {
    const root = this.element.nativeElement;
    const header = root.querySelector<HTMLElement>('[data-testid="current-lesson-header"]');
    const sections = Array.from(root.querySelectorAll<HTMLElement>('.lesson-section[data-lesson-id]'));
    if (!header || sections.length === 0) return;

    const headerBottom = header.getBoundingClientRect().bottom;
    let currentLessonId = sections[0].dataset['lessonId'] ?? '';
    for (const section of sections) {
      if (section.getBoundingClientRect().top > headerBottom) break;
      currentLessonId = section.dataset['lessonId'] ?? currentLessonId;
    }

    if (currentLessonId && currentLessonId !== this.currentLessonId()) {
      this.currentLessonId.set(currentLessonId);
    }
  }

  async openExercise(selection: LearningPathExerciseSelection): Promise<void> {
    const path = this.facade.view()?.path;
    if (!path) return;

    if (path.learnerStatus === 'available') {
      if (this.facade.starting() || !await this.facade.start()) return;
    }

    await this.router.navigate(['/learning-paths', path.id, 'lessons', selection.lessonId, 'exercises', selection.exerciseId]);
  }

  private async loadLegacyCollectionRoute(collectionId: string): Promise<void> {
    if (!await this.facade.load(collectionId)) return;
    const publicId = this.facade.view()?.path.id;
    if (publicId && isCanonicalLearningPathPublicId(publicId)) {
      await this.router.navigate(['/learning-paths', publicId], { replaceUrl: true });
    }
  }
}
