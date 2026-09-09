import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LearningStoreService } from '../../core/state/learning-store.service';
import {
  PAGE_SIZE,
  createWord,
  isActiveLeitnerWord,
  mergeImportedWords,
  normalizeAnswer,
} from '../../domain/learning/learning-rules';
import { LearningWord } from '../../domain/learning/models';

const LEGACY_UNCATEGORIZED = '\u0628\u062f\u0648\u0646 \u062f\u0633\u062a\u0647\u200c\u0628\u0646\u062f\u06cc';

function englishCategory(value: string | null | undefined): string {
  return !value || value === LEGACY_UNCATEGORIZED ? 'Uncategorized' : value;
}

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
  imports: [RouterLink, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule],
  templateUrl: './words-page.component.html',
  styleUrl: './words-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(LearningStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly search = new FormControl('', { nonNullable: true });
  readonly box = new FormControl('all', { nonNullable: true });
  readonly sort = new FormControl('number', { nonNullable: true });
  private readonly searchValue = toSignal(this.search.valueChanges, { initialValue: this.search.value });
  private readonly boxValue = toSignal(this.box.valueChanges, { initialValue: this.box.value });
  private readonly sortValue = toSignal(this.sort.valueChanges, { initialValue: this.sort.value });
  readonly visibleCount = signal(PAGE_SIZE);
  readonly activatingId = signal('');
  readonly columns = ['term', 'box'];
  readonly String = String;
  private observer?: IntersectionObserver;

  @ViewChild('loadMoreSentinel') private loadMoreSentinel?: ElementRef<HTMLElement>;

  readonly filtered = computed(() => {
    const state = this.store.state();
    if (!state) return [];
    const q = normalizeAnswer(this.searchValue());
    const box = this.boxValue();
    const sort = this.sortValue();
    const words = state.words.filter((word) => {
      const match = !q || normalizeAnswer(
        `${word.term} ${word.accepted.join(' ')} ${englishCategory(word.category)} ${word.tags.join(' ')} ${word.lessons.join(' ')}`,
      ).includes(q);
      const boxNumber = Number(box);
      const matchBox = box === 'all'
        || (boxNumber === 0 ? word.box === 0 : isActiveLeitnerWord(word) && word.box === boxNumber);
      return match && matchBox;
    });
    return words.sort((a, b) => sort === 'mistakes'
      ? b.mistakes - a.mistakes || a.number - b.number
      : sort === 'due'
        ? (a.due || '9999').localeCompare(b.due || '9999') || a.number - b.number
        : sort === 'alpha'
          ? a.term.localeCompare(b.term, 'en')
          : a.number - b.number);
  });
  readonly visibleWords = computed(() => this.filtered().slice(0, this.visibleCount()));
  readonly hasMore = computed(() => this.visibleWords().length < this.filtered().length);

  async ngOnInit(): Promise<void> { await this.store.initialize(); }

  ngAfterViewInit(): void {
    if (!globalThis.IntersectionObserver || !this.loadMoreSentinel) return;
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
    }, { rootMargin: '240px 0px' });
    this.observer.observe(this.loadMoreSentinel.nativeElement);
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }

  resetVisible(): void {
    this.visibleCount.set(PAGE_SIZE);
    this.reobserveSentinel();
  }

  loadMore(): void {
    if (!this.hasMore()) return;
    this.visibleCount.update((count) => Math.min(count + PAGE_SIZE, this.filtered().length));
    this.reobserveSentinel();
  }

  private reobserveSentinel(): void {
    queueMicrotask(() => {
      if (!this.observer || !this.loadMoreSentinel || !this.hasMore()) return;
      this.observer.unobserve(this.loadMoreSentinel.nativeElement);
      this.observer.observe(this.loadMoreSentinel.nativeElement);
    });
  }

  async activate(word: LearningWord): Promise<void> {
    if (this.activatingId()) return;
    this.activatingId.set(word.id);
    try {
      await this.store.activateWord(word);
      this.snack.open(`“${word.term}” was added to Box 1.`, 'OK', { duration: 2500 });
    } finally {
      this.activatingId.set('');
    }
  }

  async editWord(word: LearningWord | null = null): Promise<void> {
    const value = await firstValueFrom(
      this.dialog.open(WordDialogComponent, { data: { word } }).afterClosed(),
    ) as WordDialogValue | undefined;
    if (!value) return;
    await this.store.update((state) => {
      const variants = value.variants.split(/\s*\/\s*/u).map((item) => item.trim()).filter(Boolean);
      if (word) {
        const target = state.words.find((item) => item.id === word.id);
        if (target) {
          target.term = value.term.trim();
          target.accepted = [...new Set([target.term, ...variants])];
          target.category = value.category.trim() || 'Uncategorized';
          target.notes = value.notes.trim();
        }
      } else {
        state.words.push(createWord({
          term: value.term.trim(),
          accepted: [value.term.trim(), ...variants],
          category: value.category.trim() || 'Uncategorized',
          notes: value.notes.trim(),
          number: state.words.length + 1,
        }, state.words.length));
      }
    });
    this.snack.open(word ? 'Word updated.' : 'Word added.', 'OK', { duration: 2000 });
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = mergeImportedWords(this.store.snapshot(), await file.text());
      await this.store.replaceAndPersist(result.state);
      this.resetVisible();
      this.snack.open(`${result.added} words added; ${result.skipped} duplicates skipped.`, 'OK', { duration: 3500 });
    } catch (error) {
      this.snack.open(error instanceof Error ? error.message : 'Import failed.', 'Close');
    } finally {
      input.value = '';
    }
  }
}
