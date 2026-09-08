import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { Router, RouterLink } from '@angular/router';
import { LibraryLearningPathJourneyFacade } from '../../application/collection-learning-path/library-learning-path-journey.facade';
import { SelectedCoursesFacade } from '../../application/collection-learning-path/selected-courses.facade';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { buildHomeCourseCard, type HomeCourseCard } from '../../domain/home/home-dashboard';
import { getDueWords, localDay } from '../../domain/learning/learning-rules';
import { NavigationIconComponent } from '../../shared/app-shell/navigation-icon.component';

@Component({
  selector: 'app-home-page',
  imports: [MatButtonModule, MatCardModule, MatRippleModule, NavigationIconComponent, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit, OnDestroy {
  readonly store = inject(LearningStoreService);
  readonly selectedCourses = inject(SelectedCoursesFacade);
  readonly journeys = inject(LibraryLearningPathJourneyFacade);
  private readonly router = inject(Router);
  private rolloverTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  readonly today = signal(localDay());
  readonly reviewError = signal('');
  readonly reviewCompleted = computed(() => {
    const state = this.store.state();
    return state ? getDueWords(state, this.today()).length === 0 : false;
  });
  readonly courseCards = computed(() => this.selectedCourses.courses().map((collection) =>
    buildHomeCourseCard(collection, this.journeys.viewFor(collection.id), this.today()),
  ));

  async ngOnInit(): Promise<void> {
    await this.load();
    if (!this.destroyed) this.scheduleRollover();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.rolloverTimer);
  }

  async load(refreshState = false): Promise<void> {
    this.reviewError.set('');
    const stateRequest = refreshState
      ? this.store.refreshForLocalDay(this.today())
      : this.store.initialize();
    const [stateResult] = await Promise.allSettled([
      stateRequest,
      this.selectedCourses.load(),
    ]);
    if (stateResult.status === 'rejected') {
      this.reviewError.set("Today's review could not load. Try again.");
    }
    await this.journeys.load(this.selectedCourses.courses());
  }

  private scheduleRollover(): void {
    clearTimeout(this.rolloverTimer);
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 0, 0);
    this.rolloverTimer = setTimeout(async () => {
      if (this.destroyed) return;
      this.today.set(localDay());
      this.reviewError.set('');
      try {
        await this.store.refreshForLocalDay(this.today());
      } catch {
        this.reviewError.set("Today's review could not load. Try again.");
      }
      if (!this.destroyed) this.scheduleRollover();
    }, Math.max(1, nextDay.getTime() - now.getTime()));
  }

  async openCourse(card: HomeCourseCard): Promise<void> {
    const collection = this.selectedCourses.courses().find((candidate) => candidate.id === card.collectionId);
    if (!collection) return;
    const destination = await this.journeys.enter(collection);
    if (!destination) return;
    if (destination.kind === 'exercise') {
      await this.router.navigate([
        '/learning-path', destination.pathId, 'lessons', destination.lessonId, 'exercises', destination.exerciseId,
      ]);
      return;
    }
    await this.router.navigate(['/library', destination.collectionId, 'learning-path']);
  }
}
