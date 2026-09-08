import {ChangeDetectionStrategy, Component, OnInit, computed, inject, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatChipsModule} from '@angular/material/chips';
import {MatDialog} from '@angular/material/dialog';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatTableModule} from '@angular/material/table';
import {LibraryLearningPathJourneyFacade} from '../../application/collection-learning-path/library-learning-path-journey.facade';
import {SelectedCoursesFacade} from '../../application/collection-learning-path/selected-courses.facade';
import {LibraryApiService} from '../../core/library/library-api.service';
import {
  learningPathOverviewRoute,
  type CollectionLearningPathView,
  type LearningPathLearnerStatus,
} from '../../domain/collection-learning-path/learning-path';
import {LibraryCollection, LibraryEntry} from '../../domain/learning/models';
import {ConfirmDialogComponent} from '../../shared/confirm-dialog/confirm-dialog.component';
import {
  CollectionEditorComponent,
  CollectionPayload,
  LibraryEntryDialogComponent,
  LibraryImportDialogComponent,
  LibraryImportValue,
  libraryKindLabel,
  libraryLevel,
  libraryProgress,
} from './library-dialogs.component';

@Component({
  selector: 'app-library-detail-page',
  imports: [MatButtonModule, MatChipsModule, MatProgressBarModule, MatTableModule],
  template: `
    @if (collection(); as c) {
      <section class="detail-page" data-testid="library-detail-page">
        <button mat-button class="back-action" (click)="back()">← Back to library</button>

        <div class="detail-content">
          <h1>{{ c.title }}</h1>

          <p class="description">{{ c.description || 'A vocabulary collection for your learning journey.' }}</p>

          <mat-chip-set aria-label="Collection details">
            <mat-chip>{{ kindLabel(c.kind) }}</mat-chip>
            <mat-chip>{{ level(c) }}</mat-chip>
            <mat-chip>{{ c.status }}</mat-chip>
            <mat-chip>version {{ c.contentVersion }}</mat-chip>
          </mat-chip-set>

          <div class="progress">
            <span>{{ progress(c).entered }} of {{ progress(c).total }} words are in Leitner</span>
            <mat-progress-bar mode="determinate" [value]="progress(c).percent" />
          </div>

          <div class="learning-actions" data-testid="library-detail-actions">
            @if (course(); as courseView) {
              <div class="action-option">
                <button
                  mat-flat-button
                  data-testid="start-course-action"
                  [disabled]="learningPaths.enteringId() === c.id"
                  (click)="startCourse()"
                >
                  @if (learningPaths.enteringId() === c.id) { Opening… } @else { {{ courseActionLabel(courseView.path.learnerStatus) }} }
                </button>
                <p>Start this course to follow a structured learning path with lessons, exercises, and progress tracking.</p>
              </div>
              <div class="action-option">
                <button mat-stroked-button data-testid="leitner-only-action" (click)="toggleSubscription()">
                  {{ leitnerActionLabel(c) }}
                </button>
                <p>{{ leitnerDescription(c, true) }}</p>
              </div>
            } @else {
              <div class="action-option">
                <button mat-flat-button data-testid="leitner-only-action" (click)="toggleSubscription()">
                  {{ leitnerActionLabel(c) }}
                </button>
                <p>{{ leitnerDescription(c, false) }}</p>
              </div>
            }
          </div>

          @if (canManage()) {
            <div class="management-actions">
              <button mat-stroked-button (click)="editCollection()">Edit collection</button>
              <button mat-stroked-button (click)="importEntries()">Import file</button>
              <button mat-stroked-button (click)="editEntry()">Add word</button>
            </div>
          }

          @if (c.entries?.length) {
            <div class="table-wrap">
              <table mat-table [dataSource]="c.entries || []" data-testid="library-detail-words-table">
                <ng-container matColumnDef="term">
                  <th mat-header-cell *matHeaderCellDef>Word</th>
                  <td mat-cell *matCellDef="let entry"><strong>{{ entry.term }}</strong></td>
                </ng-container>

                <ng-container matColumnDef="section">
                  <th mat-header-cell *matHeaderCellDef>Section</th>
                  <td mat-cell *matCellDef="let entry">{{ entry.sectionPath || '—' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let entry" class="entry-actions">
                    @if (canManage()) {
                      <button mat-icon-button (click)="editEntry(entry)" title="Edit word" aria-label="Edit word">✎</button>
                      <button mat-icon-button (click)="removeEntry(entry)" title="Delete word" aria-label="Delete word">×</button>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="entryColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: entryColumns"></tr>
              </table>
            </div>
          } @else {
            <p class="empty">No words to display.</p>
          }
        </div>
      </section>
    }
  `,
  styles: [`
    :host{display:block}
    .detail-page{display:grid;gap:14px}
    .back-action{justify-self:start}
    .detail-content{display:grid;gap:16px;width:min(100%,850px)}
    h1{margin:0;font-size:28px;line-height:1.25;font-weight:500}
    .description{margin:0;line-height:1.55}
    .progress{display:grid;gap:8px}
    .learning-actions{display:grid;gap:12px}
    .action-option{display:grid;gap:8px;padding:16px;border:1px solid var(--vocora-border);border-radius:var(--vocora-radius-md);background:var(--vocora-surface-subtle)}
    .action-option button{justify-self:start;min-height:var(--vocora-touch-target-min)}
    .action-option p{margin:0;color:var(--vocora-text-secondary);font:var(--mat-sys-body-medium);line-height:1.5}
    .management-actions{display:flex;flex-wrap:wrap;gap:8px}
    .table-wrap{overflow-x:auto}
    table{width:100%}
    .entry-actions{text-align:right;white-space:nowrap}
    .empty{padding:30px;text-align:center;color:var(--mat-sys-on-surface-variant)}
    @media(max-width:640px){.action-option button{width:100%}.management-actions>*{flex:1 1 auto}.detail-content{width:100%}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryDetailPageComponent implements OnInit {
  private readonly api = inject(LibraryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly selectedCourses = inject(SelectedCoursesFacade);
  readonly learningPaths = inject(LibraryLearningPathJourneyFacade);

  readonly collection = signal<LibraryCollection | null>(null);
  readonly course = computed<CollectionLearningPathView | null>(() => {
    const current = this.collection();
    return current ? this.learningPaths.viewFor(current.id) : null;
  });
  readonly canManage = signal(false);
  readonly entryColumns = ['term', 'section', 'actions'];
  readonly level = libraryLevel;
  readonly progress = libraryProgress;
  readonly kindLabel = libraryKindLabel;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigate(['/library']);
      return;
    }
    await this.load(id);
  }

  private async load(id: string): Promise<void> {
    const result = await this.api.get(id);
    this.collection.set(result.collection);
    this.canManage.set(Boolean(result.capabilities?.canManage));
    await this.learningPaths.load([result.collection]);
  }

  private async reload(): Promise<void> {
    const current = this.collection();
    if (!current) return;
    await this.load(current.id);
  }

  async toggleSubscription(): Promise<void> {
    const current = this.collection();
    if (!current) return;
    if (current.subscribed) await this.api.unsubscribe(current.id);
    else await this.api.subscribe(current.id);
    await this.reload();
    await this.selectedCourses.load();
  }

  courseActionLabel(status: LearningPathLearnerStatus): string {
    return {
      available: 'Start Course',
      in_progress: 'Continue Course',
      completed: 'View Course',
      up_to_date: 'View Course',
    }[status];
  }

  leitnerActionLabel(collection: LibraryCollection): string {
    return collection.subscribed ? 'Remove from Leitner' : 'Add to Leitner Only';
  }

  leitnerDescription(collection: LibraryCollection, course: boolean): string {
    if (collection.subscribed) {
      return course
        ? 'Remove these words from your Leitner box without deleting your saved course progress.'
        : 'Remove these words from your Leitner box.';
    }
    return course
      ? 'Add these words to your Leitner box and practice them daily. This will not start the course or add it to your learning path.'
      : 'Add these words to your Leitner box and practice them daily.';
  }

  async startCourse(): Promise<void> {
    const current = this.collection();
    if (!current) return;
    const destination = await this.learningPaths.enter(current);
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
    await this.router.navigate(path
      ? learningPathOverviewRoute(path.id, destination.collectionId)
      : ['/library', destination.collectionId, 'learning-path']);
  }

  async editCollection(): Promise<void> {
    const current = this.collection();
    if (!current) return;
    const value = await firstValueFrom(this.dialogs.open(CollectionEditorComponent, {
      data: {collection: current},
    }).afterClosed()) as CollectionPayload | undefined;
    if (!value) return;
    await this.api.update(current.id, value);
    await this.reload();
    this.snack.open('Collection details updated.', 'OK', {duration: 2000});
  }

  async importEntries(): Promise<void> {
    const current = this.collection();
    if (!current) return;
    const value = await firstValueFrom(this.dialogs.open(LibraryImportDialogComponent).afterClosed()) as LibraryImportValue | undefined;
    if (!value) return;
    await this.api.import(current.id, value.text, value.mode);
    await this.reload();
    this.snack.open('Word import completed.', 'OK', {duration: 2200});
  }

  async editEntry(entry: LibraryEntry | null = null): Promise<void> {
    const current = this.collection();
    if (!current) return;
    const value = await firstValueFrom(this.dialogs.open(LibraryEntryDialogComponent, {
      data: {entry},
    }).afterClosed()) as Record<string, unknown> | undefined;
    if (!value) return;
    if (entry) await this.api.updateEntry(current.id, entry.id, value);
    else await this.api.addEntry(current.id, value);
    await this.reload();
  }

  async removeEntry(entry: LibraryEntry): Promise<void> {
    const current = this.collection();
    if (!current) return;
    const confirmed = await firstValueFrom(this.dialogs.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete word',
        message: 'Remove this word from the collection?',
        confirmLabel: 'Delete',
        danger: true,
      },
    }).afterClosed());
    if (!confirmed) return;
    await this.api.removeEntry(current.id, entry.id);
    await this.reload();
  }

  back(): void {
    void this.router.navigate(['/library']);
  }
}
