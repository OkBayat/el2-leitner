import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
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
export class HomePageComponent implements OnInit {
  readonly store = inject(LearningStoreService);
  readonly selectedCourses = inject(SelectedCoursesFacade);
  readonly journeys = inject(LibraryLearningPathJourneyFacade);
  private readonly router = inject(Router);

  readonly reviewCompleted = computed(() => {
    const state = this.store.state();
    return state ? getDueWords(state).length === 0 : false;
  });
  readonly courseCards = computed(() => this.selectedCourses.courses().map((collection) =>
    buildHomeCourseCard(collection, this.journeys.viewFor(collection.id), localDay()),
  ));

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    await Promise.all([
      this.store.initialize(),
      this.selectedCourses.load(),
    ]);
    await this.journeys.load(this.selectedCourses.courses());
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
