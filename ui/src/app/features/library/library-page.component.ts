import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LibraryApiService } from '../../core/library/library-api.service';
import { LibraryCollection } from '../../domain/learning/models';
import { normalizeAnswer } from '../../domain/learning/learning-rules';
import {
  CollectionEditorComponent,
  CollectionPayload,
  LibraryDetailDialogComponent,
  libraryKindLabel,
  libraryLevel,
  libraryProgress,
} from './library-dialogs.component';

@Component({
  selector: 'app-library-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  template: `
    <section class="page">
      <header>
        <div><h1>Library</h1><p>{{ collections().length }} collections · {{ totalWords() }} words</p></div>
        @if (canManage()) { <button mat-flat-button (click)="createCollection()">New collection</button> }
      </header>

      <div class="stats">
        <mat-card appearance="outlined"><strong>{{ collections().length }}</strong><span>Collections</span></mat-card>
        <mat-card appearance="outlined"><strong>{{ totalWords() }}</strong><span>Total words</span></mat-card>
        <mat-card appearance="outlined"><strong>{{ subscribedWords() }}</strong><span>Words in my collections</span></mat-card>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline"><mat-label>Search</mat-label><input matInput [formControl]="search"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Type</mat-label><mat-select [formControl]="kind"><mat-option value="all">All</mat-option><mat-option value="book">Book</mat-option><mat-option value="exam">Exam</mat-option><mat-option value="topic">Topic</mat-option><mat-option value="course">Course</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Status</mat-label><mat-select [formControl]="status"><mat-option value="all">All</mat-option><mat-option value="subscribed">Added</mat-option><mat-option value="available">Not added</mat-option></mat-select></mat-form-field>
      </div>

      <div class="cards">
        @for (collection of filtered(); track collection.id) {
          <mat-card appearance="outlined" [attr.id]="collection.id">
            <mat-card-header><mat-card-title>{{ collection.title }}</mat-card-title><mat-card-subtitle>{{ kindLabel(collection.kind) }} · {{ level(collection) }} · version {{ collection.contentVersion }}</mat-card-subtitle></mat-card-header>
            <mat-card-content>
              <p>{{ collection.description || 'A vocabulary collection for your learning journey.' }}</p>
              <div class="count"><span>{{ collection.wordCount }} words</span><strong>{{ progress(collection).percent }}% in Leitner</strong></div>
              <mat-progress-bar mode="determinate" [value]="progress(collection).percent" />
            </mat-card-content>
            <mat-card-actions>
              <button mat-flat-button (click)="toggle(collection)">{{ collection.subscribed ? '✓ Added' : 'Add to box' }}</button>
              <button mat-button (click)="open(collection)">View words</button>
              @if (canManage()) { <button mat-icon-button (click)="edit(collection)" title="Edit">✎</button> }
            </mat-card-actions>
          </mat-card>
        } @empty { <p class="empty">No collections match these filters.</p> }
      </div>
    </section>
  `,
  styles: [`
    :host{display:block}.page{display:grid;gap:18px}header{display:flex;justify-content:space-between;align-items:center}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.stats mat-card{display:grid;padding:16px}.stats strong{font-size:28px}.filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.cards mat-card{border-radius:22px}.cards mat-card-content{display:grid;gap:10px}.count{display:flex;justify-content:space-between;font-size:12px}.empty{grid-column:1/-1;text-align:center;padding:40px}@media(max-width:1000px){.cards{grid-template-columns:1fr 1fr}}@media(max-width:700px){.stats,.filters,.cards{grid-template-columns:1fr}header{align-items:stretch;flex-direction:column}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPageComponent implements OnInit {
  private readonly api = inject(LibraryApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly collections = signal<LibraryCollection[]>([]);
  readonly canManage = signal(false);
  readonly search = new FormControl('', { nonNullable: true });
  readonly kind = new FormControl('all', { nonNullable: true });
  readonly status = new FormControl('all', { nonNullable: true });
  private readonly searchValue = toSignal(this.search.valueChanges, { initialValue: this.search.value });
  private readonly kindValue = toSignal(this.kind.valueChanges, { initialValue: this.kind.value });
  private readonly statusValue = toSignal(this.status.valueChanges, { initialValue: this.status.value });
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

  async ngOnInit(): Promise<void> { await this.load(); }
  async load(): Promise<void> { const result = await this.api.list(); this.collections.set(result.collections || []); this.canManage.set(Boolean(result.capabilities?.canManage)); }
  async toggle(collection: LibraryCollection): Promise<void> { if (collection.subscribed) await this.api.unsubscribe(collection.id); else await this.api.subscribe(collection.id); await this.load(); }
  async open(collection: LibraryCollection): Promise<void> { const detail = await this.api.get(collection.id); const changed = await firstValueFrom(this.dialog.open(LibraryDetailDialogComponent, { data: { collection: detail.collection, canManage: Boolean(detail.capabilities?.canManage) }, maxWidth: '95vw' }).afterClosed()); if (changed) await this.load(); }
  async createCollection(): Promise<void> { const value = await firstValueFrom(this.dialog.open(CollectionEditorComponent, { data: { collection: null } }).afterClosed()) as CollectionPayload | undefined; if (!value) return; const result = await this.api.create(value); await this.load(); this.snack.open('Collection created.', 'OK', { duration: 2000 }); await this.open(result.collection); }
  async edit(collection: LibraryCollection): Promise<void> { const value = await firstValueFrom(this.dialog.open(CollectionEditorComponent, { data: { collection } }).afterClosed()) as CollectionPayload | undefined; if (!value) return; await this.api.update(collection.id, value); await this.load(); }
}
