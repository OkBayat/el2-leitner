import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VocoErrorButtonComponent, VocoIconButtonComponent, VocoNavigationButtonComponent, VocoPrimaryButtonComponent, VocoSecondaryButtonComponent } from '../../shared/voco-button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { LibraryApiService } from '../../core/library/library-api.service';
import { LibraryCollection, LibraryEntry } from '../../domain/learning/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

export function libraryLevel(collection: LibraryCollection): string {
  return String(collection.metadata?.['level'] || '').trim() || '—';
}

export function libraryProgress(collection: LibraryCollection): { total: number; entered: number; percent: number } {
  const total = Math.max(0, Number(collection.wordCount) || 0);
  const entered = Math.min(total, Math.max(0, Number(collection.leitnerWordCount) || 0));
  return { total, entered, percent: total ? Math.round((entered / total) * 100) : 0 };
}

export function libraryKindLabel(kind: string): string {
  return ({ book: 'Book', exam: 'Exam', topic: 'Topic', course: 'Course', personal: 'Personal', collection: 'Collection' } as Record<string, string>)[kind] || 'Collection';
}

function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/['’]/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '').replace(/-{2,}/gu, '-').slice(0, 160);
}

export interface CollectionPayload {
  title: string;
  slug: string;
  description: string;
  kind: string;
  visibility: string;
  status: string;
  metadata: Record<string, unknown>;
}

@Component({
  selector: 'app-collection-editor',
  imports: [ReactiveFormsModule, MatDialogModule, VocoNavigationButtonComponent, VocoPrimaryButtonComponent, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.collection ? 'Edit collection' : 'New collection' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Slug</mat-label><input matInput formControlName="slug"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Description</mat-label><textarea matInput rows="3" formControlName="description"></textarea></mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline"><mat-label>Type</mat-label><mat-select formControlName="kind"><mat-option value="book">Book</mat-option><mat-option value="exam">Exam</mat-option><mat-option value="topic">Topic</mat-option><mat-option value="course">Course</mat-option><mat-option value="personal">Personal</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>CEFR level</mat-label><input matInput formControlName="level" placeholder="B1"></mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline"><mat-label>Visibility</mat-label><mat-select formControlName="visibility"><mat-option value="public">Public</mat-option><mat-option value="unlisted">Unlisted</mat-option><mat-option value="private">Private</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Status</mat-label><mat-select formControlName="status"><mat-option value="published">Published</mat-option><mat-option value="draft">Draft</mat-option><mat-option value="archived">Archived</mat-option></mat-select></mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><voco-navigation-button (activated)="dialog.close()"
				>Cancel</voco-navigation-button><voco-primary-button [disabled]="form.invalid" (activated)="save()"
				>Save</voco-primary-button></mat-dialog-actions>
  `,
  styles: [`.form{display:grid;min-width:min(75vw,650px);padding-top:8px}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:600px){.row{grid-template-columns:1fr}}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionEditorComponent {
  readonly data = inject<{ collection: LibraryCollection | null }>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<CollectionEditorComponent>);
  readonly form = new FormGroup({
    title: new FormControl(this.data.collection?.title || '', { nonNullable: true, validators: [Validators.required] }),
    slug: new FormControl(this.data.collection?.slug || '', { nonNullable: true }),
    description: new FormControl(this.data.collection?.description || '', { nonNullable: true }),
    kind: new FormControl(this.data.collection?.kind || 'book', { nonNullable: true }),
    level: new FormControl(this.data.collection && libraryLevel(this.data.collection) !== '—' ? libraryLevel(this.data.collection) : '', { nonNullable: true }),
    visibility: new FormControl(this.data.collection?.visibility || 'public', { nonNullable: true }),
    status: new FormControl(this.data.collection?.status || 'published', { nonNullable: true }),
  });

  save(): void {
    const raw = this.form.getRawValue();
    const metadata = { ...(this.data.collection?.metadata || {}) };
    if (raw.level) metadata['level'] = raw.level;
    else delete metadata['level'];
    this.dialog.close({
      title: raw.title.trim(),
      slug: raw.slug.trim() || slugify(raw.title),
      description: raw.description.trim(),
      kind: raw.kind,
      visibility: raw.visibility,
      status: raw.status,
      metadata,
    } satisfies CollectionPayload);
  }
}

export interface LibraryImportValue { text: string; mode: 'replace' | 'append' }

@Component({
  selector: 'app-library-import-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, VocoNavigationButtonComponent, VocoPrimaryButtonComponent, VocoSecondaryButtonComponent, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Import words</h2>
    <mat-dialog-content>
      <input #file hidden type="file" accept=".md,.txt,text/plain,text/markdown" (change)="loadFile($event)">
      <voco-secondary-button (activated)="file.click()"
				>Choose MD / TXT file</voco-secondary-button>
      <mat-form-field appearance="outline" class="wide"><mat-label>Word text</mat-label><textarea matInput rows="12" [formControl]="text"></textarea></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Import mode</mat-label><mat-select [formControl]="mode"><mat-option value="replace">Replace content</mat-option><mat-option value="append">Append to content</mat-option></mat-select></mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><voco-navigation-button (activated)="dialog.close()"
				>Cancel</voco-navigation-button><voco-primary-button
				[disabled]="!text.value.trim()"
				(activated)="submit()"
				>Import</voco-primary-button></mat-dialog-actions>
  `,
  styles: [`.wide{display:block;width:min(75vw,700px);margin-top:14px}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryImportDialogComponent {
  readonly dialog = inject(MatDialogRef<LibraryImportDialogComponent>);
  readonly text = new FormControl('', { nonNullable: true });
  readonly mode = new FormControl<'replace' | 'append'>('replace', { nonNullable: true });
  async loadFile(event: Event): Promise<void> { const file = (event.target as HTMLInputElement).files?.[0]; if (file) this.text.setValue(await file.text()); }
  submit(): void { this.dialog.close({ text: this.text.value, mode: this.mode.value } satisfies LibraryImportValue); }
}

@Component({
  selector: 'app-library-entry-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, VocoNavigationButtonComponent, VocoPrimaryButtonComponent, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.entry ? 'Edit word' : 'New word' }}</h2>
    <mat-dialog-content><form [formGroup]="form" class="form">
      <mat-form-field appearance="outline"><mat-label>Word</mat-label><input matInput formControlName="term"></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Alternative spellings separated by /</mat-label><input matInput formControlName="variants"></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Section / lesson</mat-label><input matInput formControlName="section"></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Note</mat-label><textarea matInput rows="3" formControlName="note"></textarea></mat-form-field>
    </form></mat-dialog-content>
    <mat-dialog-actions align="end"><voco-navigation-button (activated)="dialog.close()"
				>Cancel</voco-navigation-button><voco-primary-button
				[disabled]="form.invalid"
				(activated)="dialog.close(payload())"
				>Save</voco-primary-button></mat-dialog-actions>
  `,
  styles: [`.form{display:grid;min-width:min(70vw,520px);padding-top:8px}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryEntryDialogComponent {
  readonly data = inject<{ entry: LibraryEntry | null }>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<LibraryEntryDialogComponent>);
  readonly form = new FormGroup({
    term: new FormControl(String(this.data.entry?.['term'] || ''), { nonNullable: true, validators: [Validators.required] }),
    variants: new FormControl(Array.isArray(this.data.entry?.['acceptedForms']) ? (this.data.entry?.['acceptedForms'] as string[]).join(' / ') : '', { nonNullable: true }),
    section: new FormControl(String(this.data.entry?.['sectionPath'] || ''), { nonNullable: true }),
    note: new FormControl(String(this.data.entry?.['note'] || ''), { nonNullable: true }),
  });
  payload(): Record<string, unknown> { const raw = this.form.getRawValue(); return { term: raw.term.trim(), acceptedForms: raw.variants.split(/\s*\/\s*/u).map((item) => item.trim()).filter(Boolean), sectionPath: raw.section.trim() || null, note: raw.note.trim() || null }; }
}

@Component({
  selector: 'app-library-detail-dialog',
  imports: [MatDialogModule, VocoErrorButtonComponent, VocoIconButtonComponent, VocoNavigationButtonComponent, VocoPrimaryButtonComponent, VocoSecondaryButtonComponent, MatChipsModule, MatProgressBarModule, MatTableModule],
  template: `
    @if (collection(); as c) {
      <h2 mat-dialog-title>{{ c.title }}</h2>
      <mat-dialog-content class="detail">
        <p>{{ c.description || 'A vocabulary collection for your learning journey.' }}</p>
        <mat-chip-set><mat-chip>{{ kindLabel(c.kind) }}</mat-chip><mat-chip>{{ level(c) }}</mat-chip><mat-chip>{{ c.status }}</mat-chip><mat-chip>version {{ c.contentVersion }}</mat-chip></mat-chip-set>
        <div class="progress"><span>{{ progress(c).entered }} of {{ progress(c).total }} words are in Leitner</span><mat-progress-bar mode="determinate" [value]="progress(c).percent" /></div>
        <div class="actions">@if(c.subscribed){<voco-error-button (activated)="toggleSubscription()">Remove from box</voco-error-button>}@else{<voco-primary-button (activated)="toggleSubscription()">Add to box</voco-primary-button>}@if(data.canManage){<voco-secondary-button (activated)="editCollection()"
							>Edit collection</voco-secondary-button><voco-secondary-button (activated)="importEntries()"
							>Import file</voco-secondary-button><voco-secondary-button (activated)="editEntry()"
							>Add word</voco-secondary-button>}</div>
        @if (c.entries?.length) {
          <table mat-table [dataSource]="c.entries || []">
            <ng-container matColumnDef="term"><th mat-header-cell *matHeaderCellDef>Word</th><td mat-cell *matCellDef="let entry"><strong>{{ entry.term }}</strong></td></ng-container>
            <ng-container matColumnDef="section"><th mat-header-cell *matHeaderCellDef>Section</th><td mat-cell *matCellDef="let entry">{{ entry.sectionPath || '—' }}</td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let entry">@if(data.canManage){<voco-icon-button aria-label="Edit word" (activated)="editEntry(entry)"
										>✎</voco-icon-button><voco-icon-button
										aria-label="Delete word"
										(activated)="removeEntry(entry)"
										>×</voco-icon-button>}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="entryColumns"></tr><tr mat-row *matRowDef="let row; columns: entryColumns"></tr>
          </table>
        } @else { <p class="empty">No words to display.</p> }
      </mat-dialog-content>
      <mat-dialog-actions><voco-navigation-button (activated)="dialog.close(changed)"
					>Close</voco-navigation-button></mat-dialog-actions>
    }
  `,
  styles: [`.detail{min-width:min(82vw,850px);display:grid;gap:16px}.progress{display:grid;gap:8px}.actions{display:flex;flex-wrap:wrap;gap:8px}table{width:100%}.empty{padding:30px;text-align:center;color:var(--mat-sys-on-surface-variant)}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryDetailDialogComponent {
  readonly data = inject<{ collection: LibraryCollection; canManage: boolean }>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<LibraryDetailDialogComponent>);
  private readonly api = inject(LibraryApiService);
  private readonly dialogs = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly collection = signal(structuredClone(this.data.collection));
  readonly entryColumns = ['term', 'section', 'actions'];
  changed = false;
  readonly level = libraryLevel;
  readonly progress = libraryProgress;
  readonly kindLabel = libraryKindLabel;

  async reload(): Promise<void> { const result = await this.api.get(this.collection().id); this.collection.set(result.collection); }
  async toggleSubscription(): Promise<void> { const collection = this.collection(); if (collection.subscribed) await this.api.unsubscribe(collection.id); else await this.api.subscribe(collection.id); this.changed = true; await this.reload(); }
  async editCollection(): Promise<void> { const value = await firstValueFrom(this.dialogs.open(CollectionEditorComponent, { data: { collection: this.collection() } }).afterClosed()) as CollectionPayload | undefined; if (!value) return; await this.api.update(this.collection().id, value); this.changed = true; await this.reload(); this.snack.open('Collection details updated.', 'OK', { duration: 2000 }); }
  async importEntries(): Promise<void> { const value = await firstValueFrom(this.dialogs.open(LibraryImportDialogComponent).afterClosed()) as LibraryImportValue | undefined; if (!value) return; await this.api.import(this.collection().id, value.text, value.mode); this.changed = true; await this.reload(); this.snack.open('Word import completed.', 'OK', { duration: 2200 }); }
  async editEntry(entry: LibraryEntry | null = null): Promise<void> { const value = await firstValueFrom(this.dialogs.open(LibraryEntryDialogComponent, { data: { entry } }).afterClosed()) as Record<string, unknown> | undefined; if (!value) return; if (entry) await this.api.updateEntry(this.collection().id, entry.id, value); else await this.api.addEntry(this.collection().id, value); this.changed = true; await this.reload(); }
  async removeEntry(entry: LibraryEntry): Promise<void> { const ok = await firstValueFrom(this.dialogs.open(ConfirmDialogComponent, { data: { title: 'Delete word', message: 'Remove this word from the collection?', confirmLabel: 'Delete', danger: true } }).afterClosed()); if (!ok) return; await this.api.removeEntry(this.collection().id, entry.id); this.changed = true; await this.reload(); }
}
