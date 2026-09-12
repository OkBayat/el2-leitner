import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnInit, computed, inject, signal} from '@angular/core';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import { VocoPrimaryButtonComponent, VocoSecondaryButtonComponent, VocoButtonInteractionDirective } from '../../shared/voco-button';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {LibraryLearningPathJourneyFacade} from '../../application/collection-learning-path/library-learning-path-journey.facade';
import {LibraryApiService} from '../../core/library/library-api.service';
import {LibraryCollection} from '../../domain/learning/models';
import {
  CollectionEditorComponent,
  CollectionPayload,
} from './library-dialogs.component';

interface PersonalLibraryItem {
  collection: LibraryCollection;
  title: string;
  kind: 'course' | 'collection';
}

interface LibraryCourseItem {
  collection: LibraryCollection;
  title: string;
}

function alphabetical<T extends {title: string}>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.title.localeCompare(right.title));
}

@Component({
  selector: 'app-library-page',
  imports: [CommonModule, VocoPrimaryButtonComponent, VocoSecondaryButtonComponent, VocoButtonInteractionDirective],
  templateUrl: 'library-page.component.html',
  styleUrl: 'library-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPageComponent implements OnInit {
  private readonly api = inject(LibraryApiService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly learningPaths = inject(LibraryLearningPathJourneyFacade);

  readonly collections = signal<LibraryCollection[]>([]);
  readonly canManage = signal(false);
  readonly allCollections = computed(() => alphabetical(this.collections()));
  readonly allCourses = computed<LibraryCourseItem[]>(() => alphabetical(this.collections().flatMap((collection) => {
    const course = this.learningPaths.courseSummaryFor(collection.id);
    return course ? [{collection, title: course.title}] : [];
  })));
  readonly myItems = computed<PersonalLibraryItem[]>(() => this.allCollections().flatMap((collection) => {
    const course = this.learningPaths.courseSummaryFor(collection.id);
    const enrolled = Boolean(course?.enrolled);
    if (!enrolled && !collection.subscribed) return [];
    const kind: PersonalLibraryItem['kind'] = enrolled ? 'course' : 'collection';
    return [{
      collection,
      title: enrolled ? course!.title : collection.title,
      kind,
    }];
  }).sort((left, right) => left.title.localeCompare(right.title)));

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const result = await this.api.list();
    const collections = result.collections || [];
    await this.learningPaths.loadCatalog(collections);
    this.collections.set(collections);
    this.canManage.set(Boolean(result.capabilities?.canManage));
  }

  open(collection: LibraryCollection): void {
    void this.router.navigate(['/library', collection.id]);
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
