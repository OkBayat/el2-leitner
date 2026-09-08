import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnInit, computed, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDialog} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatSnackBar} from '@angular/material/snack-bar';
import {LibraryLearningPathJourneyFacade} from '../../application/collection-learning-path/library-learning-path-journey.facade';
import {SelectedCoursesFacade} from '../../application/collection-learning-path/selected-courses.facade';
import {LibraryApiService} from '../../core/library/library-api.service';
import {
  learningPathPrimaryAction,
  summarizeLearningPath,
  type CollectionLearningPathView,
} from '../../domain/collection-learning-path/learning-path';
import {LibraryCollection} from '../../domain/learning/models';
import {normalizeAnswer} from '../../domain/learning/learning-rules';
import {
  CollectionEditorComponent,
  CollectionPayload,
  libraryKindLabel,
  libraryLevel,
  libraryProgress,
} from './library-dialogs.component';
import {libraryCoverAssetPath} from './library-cover';

@Component({
  selector: 'app-library-page',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  templateUrl: 'library-page.component.html',
  styleUrl: 'library-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPageComponent implements OnInit {
  private readonly api = inject(LibraryApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly selectedCourses = inject(SelectedCoursesFacade);
  private readonly missingCoverSlugs = signal<ReadonlySet<string>>(new Set());
  readonly learningPaths = inject(LibraryLearningPathJourneyFacade);

  readonly collections = signal<LibraryCollection[]>([]);
  readonly canManage = signal(false);
  readonly search = new FormControl('', {nonNullable: true});
  readonly kind = new FormControl('all', {nonNullable: true});
  readonly status = new FormControl('all', {nonNullable: true});
  private readonly searchValue = toSignal(this.search.valueChanges, {initialValue: this.search.value});
  private readonly kindValue = toSignal(this.kind.valueChanges, {initialValue: this.kind.value});
  private readonly statusValue = toSignal(this.status.valueChanges, {initialValue: this.status.value});

  readonly filtered = computed(() => {
    const query = normalizeAnswer(this.searchValue());
    const kind = this.kindValue();
    const status = this.statusValue();
    return this.collections().filter((collection) =>
      (!query || normalizeAnswer(`${collection.title} ${collection.description || ''} ${collection.kind} ${libraryLevel(collection)}`).includes(query))
      && (kind === 'all' || collection.kind === kind)
      && (status === 'all' || (status === 'subscribed' ? collection.subscribed : !collection.subscribed))
    );
  });

  readonly totalWords = computed(() => this.collections().reduce((sum, collection) => sum + collection.wordCount, 0));
  readonly subscribedWords = computed(() => this.collections().filter((collection) => collection.subscribed).reduce((sum, collection) => sum + collection.wordCount, 0));
  readonly level = libraryLevel;
  readonly progress = libraryProgress;
  readonly kindLabel = libraryKindLabel;
  readonly pathSummary = summarizeLearningPath;
  readonly pathAction = (view: CollectionLearningPathView) => learningPathPrimaryAction(view.path.learnerStatus);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const result = await this.api.list();
    const collections = result.collections || [];
    await this.learningPaths.load(collections);
    this.collections.set(collections);
    this.canManage.set(Boolean(result.capabilities?.canManage));
  }

  learningPathFor(collection: LibraryCollection): CollectionLearningPathView | null {
    return this.learningPaths.viewFor(collection.id);
  }

  coverUrl(collection: LibraryCollection): string {
    return libraryCoverAssetPath(collection.slug);
  }

  coverMissing(slug: string): boolean {
    return this.missingCoverSlugs().has(slug);
  }

  markCoverMissing(slug: string): void {
    this.missingCoverSlugs.update((current) => new Set([...current, slug]));
  }

  open(collection: LibraryCollection): void {
    void this.router.navigate(['/library', collection.id]);
  }

  async enterLearningPath(collection: LibraryCollection): Promise<void> {
    const destination = await this.learningPaths.enter(collection);
    if (!destination) {
      if (this.learningPaths.error()) this.snack.open(this.learningPaths.error(), 'OK', {duration: 3000});
      return;
    }
    await this.selectedCourses.load();
    if (destination.kind === 'exercise') {
      await this.router.navigate([
        '/learning-paths', destination.pathId, 'lessons', destination.lessonId, 'exercises', destination.exerciseId,
      ]);
      return;
    }
    const path = this.learningPaths.viewFor(destination.collectionId)?.path;
    await this.router.navigate(path ? ['/learning-paths', path.id] : ['/library', destination.collectionId, 'learning-path']);
  }

  async toggle(collection: LibraryCollection): Promise<void> {
    if (collection.subscribed) await this.api.unsubscribe(collection.id);
    else await this.api.subscribe(collection.id);
    await this.load();
    await this.selectedCourses.load();
  }

  async createCollection(): Promise<void> {
    const value = await firstValueFrom(this.dialogs.open(CollectionEditorComponent, {
      data: {collection: null},
    }).afterClosed()) as CollectionPayload | undefined;
    if (!value) return;
    const result = await this.api.create(value);
    await this.load();
    this.snack.open('Collection created.', 'OK', {duration: 2000});
    void this.router.navigate(['/library', result.collection.id]);
  }
}
