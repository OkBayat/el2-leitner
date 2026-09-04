import {ChangeDetectionStrategy, Component, OnInit, inject, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatChipsModule} from '@angular/material/chips';
import {MatDialog} from '@angular/material/dialog';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatTableModule} from '@angular/material/table';
import {LibraryApiService} from '../../core/library/library-api.service';
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

          <div class="actions" data-testid="library-detail-actions">
            <button mat-flat-button (click)="toggleSubscription()">{{ c.subscribed ? 'Remove from box' : 'Add to box' }}</button>
            @if (canManage()) {
              <button mat-stroked-button (click)="editCollection()">Edit collection</button>
              <button mat-stroked-button (click)="importEntries()">Import file</button>
              <button mat-stroked-button (click)="editEntry()">Add word</button>
            }
          </div>

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
    .actions{display:flex;flex-wrap:wrap;gap:8px}
    .table-wrap{overflow-x:auto}
    table{width:100%}
    .entry-actions{text-align:right;white-space:nowrap}
    .empty{padding:30px;text-align:center;color:var(--mat-sys-on-surface-variant)}
    @media(max-width:640px){.actions>*{flex:1 1 auto}.detail-content{width:100%}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryDetailPageComponent implements OnInit {
  private readonly api = inject(LibraryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly collection = signal<LibraryCollection | null>(null);
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
