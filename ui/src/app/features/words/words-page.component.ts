import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { VocabularyApiService, VocabularySourceInfo } from '../../core/learning/vocabulary-api.service';
import { SpeechService } from '../../core/speech/speech.service';
import { createWord, isActiveLeitnerWord, mergeImportedWords, normalizeAnswer, PAGE_SIZE } from '../../domain/learning/learning-rules';
import { LearningWord } from '../../domain/learning/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

const LEGACY_UNCATEGORIZED = '\u0628\u062f\u0648\u0646 \u062f\u0633\u062a\u0647\u200c\u0628\u0646\u062f\u06cc';
function englishCategory(value: string | null | undefined): string { return !value || value === LEGACY_UNCATEGORIZED ? 'Uncategorized' : value; }

interface WordDialogData { word: LearningWord | null }
interface WordDialogValue { term: string; variants: string; category: string; notes: string }

@Component({
  selector: 'app-word-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `<h2 mat-dialog-title>{{ data.word ? 'Edit word' : 'Add word' }}</h2><mat-dialog-content><form [formGroup]="form" class="dialog-form"><mat-form-field appearance="outline"><mat-label>English word or phrase</mat-label><input matInput formControlName="term"></mat-form-field><mat-form-field appearance="outline"><mat-label>Alternative spellings separated by /</mat-label><input matInput formControlName="variants"></mat-form-field><mat-form-field appearance="outline"><mat-label>Category</mat-label><input matInput formControlName="category"></mat-form-field><mat-form-field appearance="outline"><mat-label>Note or meaning</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field></form></mat-dialog-content><mat-dialog-actions align="end"><button mat-button (click)="dialog.close()">Cancel</button><button mat-flat-button [disabled]="form.invalid" (click)="save()">Save</button></mat-dialog-actions>`,
  styles: [`.dialog-form{display:grid;min-width:min(70vw,520px);padding-top:8px}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordDialogComponent {
  readonly data = inject<WordDialogData>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<WordDialogComponent>);
  readonly form = new FormGroup({
    term: new FormControl(this.data.word?.term || '', { nonNullable: true, validators: [Validators.required] }),
    variants: new FormControl(this.data.word ? this.data.word.accepted.slice(1).join(' / ') : '', { nonNullable: true }),
    category: new FormControl(englishCategory(this.data.word?.category), { nonNullable: true }),
    notes: new FormControl(this.data.word?.notes || '', { nonNullable: true }),
  });
  save(): void { this.dialog.close(this.form.getRawValue() as WordDialogValue); }
}

@Component({
  selector: 'app-words-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule],
  template: `<section class="page"><header><div><h1>Word Bank</h1><p>{{ filtered().length }} words</p></div><div><input #fileInput hidden type="file" accept=".md,.txt,text/plain,text/markdown" (change)="importFile($event)"><button mat-stroked-button (click)="fileInput.click()">Import MD / TXT</button><button mat-flat-button (click)="editWord()">Add word</button></div></header><div class="filters"><mat-form-field appearance="outline"><mat-label>Search</mat-label><input matInput [formControl]="search" (input)="page.set(1)"></mat-form-field><mat-form-field appearance="outline"><mat-label>House</mat-label><mat-select [formControl]="box" (selectionChange)="page.set(1)"><mat-option value="all">All</mat-option><mat-option value="0">Not introduced</mat-option>@for(h of [1,2,3,4,5]; track h){<mat-option [value]="String(h)">House {{ h }}</mat-option>}</mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>Sort</mat-label><mat-select [formControl]="sort"><mat-option value="number">Original order</mat-option><mat-option value="mistakes">Most mistakes</mat-option><mat-option value="due">Next due</mat-option><mat-option value="alpha">Alphabetical</mat-option></mat-select></mat-form-field></div><div class="table-wrap"><table mat-table [dataSource]="pageWords()"><ng-container matColumnDef="term"><th mat-header-cell *matHeaderCellDef>Word</th><td mat-cell *matCellDef="let word"><strong>{{ word.accepted.join(' / ') }}</strong></td></ng-container><ng-container matColumnDef="source"><th mat-header-cell *matHeaderCellDef>Collections</th><td mat-cell *matCellDef="let word"><div class="collection-actions">@for(source of sourcesFor(word); track source.id){<button mat-button type="button" class="collection-label" (click)="router.navigate(['/library'],{fragment:source.id})">{{ source.title }}</button>}@if(!sourcesFor(word).length){<button mat-button type="button" class="collection-label">My words</button>}</div></td></ng-container><ng-container matColumnDef="lesson"><th mat-header-cell *matHeaderCellDef>Category / lesson</th><td mat-cell *matCellDef="let word">{{ category(word.category) }} · {{ word.lessons.join(', ') || '—' }}</td></ng-container><ng-container matColumnDef="box"><th mat-header-cell *matHeaderCellDef>House</th><td mat-cell *matCellDef="let word">{{ word.masteredAt ? 'Mastered' : word.box ? 'House ' + word.box : 'Not introduced' }}</td></ng-container><ng-container matColumnDef="stats"><th mat-header-cell *matHeaderCellDef>Attempts / mistakes</th><td mat-cell *matCellDef="let word">{{ word.attempts }} / {{ word.mistakes }}</td></ng-container><ng-container matColumnDef="due"><th mat-header-cell *matHeaderCellDef>Next review</th><td mat-cell *matCellDef="let word">{{ word.due || '—' }}</td></ng-container><ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let word"><div class="row-actions"><button mat-icon-button type="button" title="Play pronunciation" aria-label="Play pronunciation" (click)="speakWord(word)">🔊</button>@if(word.box===0){<button mat-icon-button type="button" title="Add to House 1" aria-label="Add to House 1" (click)="activate(word)">＋</button>}<button mat-icon-button type="button" title="Edit" aria-label="Edit word" (click)="editWord(word)">✎</button><button mat-icon-button type="button" title="Delete" aria-label="Delete word" (click)="deleteWord(word)">×</button></div></td></ng-container><tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr></table></div><footer><button mat-stroked-button [disabled]="page()<=1" (click)="previous()">Previous</button><span>Page {{ page() }} of {{ totalPages() }}</span><button mat-stroked-button [disabled]="page()>=totalPages()" (click)="next()">Next</button></footer></section>`,
  styles: [`:host{display:block}.page{display:grid;gap:16px}header{display:flex;justify-content:space-between;align-items:center;gap:16px}header>div:last-child,.row-actions,footer{display:flex;gap:8px;align-items:center}.filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}.table-wrap{overflow:auto;border:1px solid var(--mat-sys-outline-variant);border-radius:20px}table{width:100%;min-width:900px}footer{justify-content:center}.row-actions{white-space:nowrap}@media(max-width:760px){header{align-items:stretch;flex-direction:column}.filters{grid-template-columns:1fr}}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordsPageComponent implements OnInit {
  readonly store = inject(LearningStoreService);
  private readonly vocab = inject(VocabularyApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly speech = inject(SpeechService);
  readonly router = inject(Router);
  readonly search = new FormControl('', { nonNullable: true });
  readonly box = new FormControl('all', { nonNullable: true });
  readonly sort = new FormControl('number', { nonNullable: true });
  private readonly searchValue = toSignal(this.search.valueChanges, { initialValue: this.search.value });
  private readonly boxValue = toSignal(this.box.valueChanges, { initialValue: this.box.value });
  private readonly sortValue = toSignal(this.sort.valueChanges, { initialValue: this.sort.value });
  readonly page = signal(1);
  readonly sources = signal(new Map<string, Array<{ id: string; title: string }>>());
  readonly columns = ['term', 'source', 'lesson', 'box', 'stats', 'due', 'actions'];
  readonly String = String;
  readonly category = englishCategory;
  readonly filtered = computed(() => {
    const state = this.store.state();
    if (!state) return [];
    const q = normalizeAnswer(this.searchValue());
    const box = this.boxValue();
    const sort = this.sortValue();
    const words = state.words.filter((word) => {
      const match = !q || normalizeAnswer(`${word.term} ${word.accepted.join(' ')} ${englishCategory(word.category)} ${word.tags.join(' ')} ${word.lessons.join(' ')}`).includes(q);
      const n = Number(box);
      const matchBox = box === 'all' || (n === 0 ? word.box === 0 : isActiveLeitnerWord(word) && word.box === n);
      return match && matchBox;
    });
    return words.sort((a, b) => sort === 'mistakes' ? b.mistakes - a.mistakes || a.number - b.number : sort === 'due' ? (a.due || '9999').localeCompare(b.due || '9999') || a.number - b.number : sort === 'alpha' ? a.term.localeCompare(b.term, 'en') : a.number - b.number);
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly pageWords = computed(() => { const p = Math.min(this.page(), this.totalPages()); return this.filtered().slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE); });

  async ngOnInit(): Promise<void> { await this.store.initialize(); await this.refreshSources(); }
  sourcesFor(word: LearningWord): Array<{ id: string; title: string }> { return this.sources().get(word.id) || []; }
  async refreshSources(): Promise<void> { const ids = this.pageWords().map((word) => word.id); const result = await this.vocab.sources(ids); const map = new Map<string, Array<{ id: string; title: string }>>(); result.forEach((item: VocabularySourceInfo) => map.set(item.vocabularyId, item.collections)); this.sources.set(map); }
  async previous(): Promise<void> { this.page.update((value) => Math.max(1, value - 1)); await this.refreshSources(); }
  async next(): Promise<void> { this.page.update((value) => Math.min(this.totalPages(), value + 1)); await this.refreshSources(); }
  speakWord(word: LearningWord): void { this.speech.speak(word.term, this.store.snapshot().settings.voiceRate); }
  async activate(word: LearningWord): Promise<void> { await this.store.activateWord(word); this.snack.open(`“${word.term}” was added to House 1.`, 'OK', { duration: 2500 }); }
  async editWord(word: LearningWord | null = null): Promise<void> {
    const value = await firstValueFrom(this.dialog.open(WordDialogComponent, { data: { word } }).afterClosed()) as WordDialogValue | undefined;
    if (!value) return;
    await this.store.update((state) => {
      const variants = value.variants.split(/\s*\/\s*/u).map((item) => item.trim()).filter(Boolean);
      if (word) {
        const target = state.words.find((item) => item.id === word.id);
        if (target) { target.term = value.term.trim(); target.accepted = [...new Set([target.term, ...variants])]; target.category = value.category.trim() || 'Uncategorized'; target.notes = value.notes.trim(); }
      } else state.words.push(createWord({ term: value.term.trim(), accepted: [value.term.trim(), ...variants], category: value.category.trim() || 'Uncategorized', notes: value.notes.trim(), number: state.words.length + 1 }, state.words.length));
    });
    this.snack.open(word ? 'Word updated.' : 'Word added.', 'OK', { duration: 2000 });
  }
  async deleteWord(word: LearningWord): Promise<void> { const ok = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, { data: { title: 'Delete word', message: `Delete “${word.term}”?`, confirmLabel: 'Delete', danger: true } }).afterClosed()); if (!ok) return; await this.store.update((state) => { state.words = state.words.filter((item) => item.id !== word.id); }); }
  async importFile(event: Event): Promise<void> { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { const result = mergeImportedWords(this.store.snapshot(), await file.text()); await this.store.replaceAndPersist(result.state); this.snack.open(`${result.added} words added; ${result.skipped} duplicates skipped.`, 'OK', { duration: 3500 }); } catch (error) { this.snack.open(error instanceof Error ? error.message : 'Import failed.', 'Close'); } finally { input.value = ''; } }
}
