import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { VocoErrorButtonComponent, VocoNavigationLinkComponent, VocoSecondaryButtonComponent } from '../../shared/voco-button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LibraryApiService } from '../../core/library/library-api.service';
import { VocabularyApiService, VocabularySourceInfo } from '../../core/learning/vocabulary-api.service';
import { SpeechService } from '../../core/speech/speech.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { canExcludeFromWordBank } from '../../domain/learning/learning-rules';
import { LibraryEntry, LearningWord } from '../../domain/learning/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { LibraryEntryDialogComponent } from '../library/library-dialogs.component';

type WordSource = VocabularySourceInfo['collections'][number];

@Component({
  selector: 'app-word-detail-page',
  imports: [RouterLink, VocoErrorButtonComponent, VocoNavigationLinkComponent, VocoSecondaryButtonComponent],
  templateUrl: './word-detail-page.component.html',
  styleUrl: './word-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vocabulary = inject(VocabularyApiService);
  private readonly library = inject(LibraryApiService);
  private readonly dialogs = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly speech = inject(SpeechService);
  readonly store = inject(LearningStoreService);
  readonly wordId = signal('');
  readonly sources = signal<WordSource[]>([]);
  readonly canManage = signal(false);
  readonly busy = signal(false);
  readonly word = computed(() => this.store.state()?.words.find((item) => item.id === this.wordId()) ?? null);
  readonly canRemove = computed(() => {
    const current = this.word();
    return current ? canExcludeFromWordBank(current) : false;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('wordId')?.trim() ?? '';
    if (!id) {
      await this.router.navigate(['/words']);
      return;
    }
    this.wordId.set(id);
    await this.store.initialize();
    if (!this.word()) {
      await this.router.navigate(['/words']);
      return;
    }
    await this.loadDetails();
  }

  async loadDetails(): Promise<void> {
    const [sourceResult, libraryResult] = await Promise.all([
      this.vocabulary.sources([this.wordId()]),
      this.library.list(),
    ]);
    this.sources.set(sourceResult[0]?.collections ?? []);
    this.canManage.set(Boolean(libraryResult.capabilities?.canManage));
  }

  displayDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('en-GB');
  }

  boxLabel(word: LearningWord): string {
    if (word.masteredAt) return 'Mastered';
    return word.box > 0 ? `Box ${word.box}` : 'Not in Leitner';
  }

  playWord(word: LearningWord): void {
    this.speech.speak(word.term, this.store.snapshot().settings.voiceRate);
  }

  async editSource(source: WordSource): Promise<void> {
    if (!this.canManage() || this.busy()) return;
    this.busy.set(true);
    try {
      const result = await this.library.get(source.id);
      const entry = result.collection.entries?.find((item) => item.vocabularyId === this.wordId());
      if (!entry) {
        this.snack.open('This word is no longer in that collection.', 'OK', { duration: 2500 });
        return;
      }
      const value = await firstValueFrom(this.dialogs.open(LibraryEntryDialogComponent, {
        data: { entry },
      }).afterClosed()) as Record<string, unknown> | undefined;
      if (!value) return;
      await this.library.updateEntry(source.id, entry.id, value);
      await this.refreshAfterManagedChange();
      this.snack.open('Word updated.', 'OK', { duration: 2000 });
    } finally {
      this.busy.set(false);
    }
  }

  async deleteSource(source: WordSource): Promise<void> {
    if (!this.canManage() || this.busy()) return;
    const entry = await this.entryForSource(source);
    if (!entry) return;
    const confirmed = await firstValueFrom(this.dialogs.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete word from collection',
        message: `Remove “${this.word()?.term ?? 'this word'}” from ${source.title}?`,
        confirmLabel: 'Delete',
        danger: true,
      },
    }).afterClosed());
    if (!confirmed) return;
    this.busy.set(true);
    try {
      await this.library.removeEntry(source.id, entry.id);
      await this.refreshAfterManagedChange();
      this.snack.open('Word removed from the collection.', 'OK', { duration: 2200 });
    } finally {
      this.busy.set(false);
    }
  }

  async removeFromWordBank(): Promise<void> {
    const current = this.word();
    if (!current || !this.canRemove() || this.busy()) return;
    const confirmed = await firstValueFrom(this.dialogs.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove from my Word Bank',
        message: `Remove “${current.term}” from your Word Bank?`,
        confirmLabel: 'Remove',
        danger: true,
      },
    }).afterClosed());
    if (!confirmed) return;
    this.busy.set(true);
    try {
      await this.store.excludeWord(current);
      this.snack.open('Word removed from your Word Bank.', 'OK', { duration: 2200 });
      await this.router.navigate(['/words']);
    } finally {
      this.busy.set(false);
    }
  }

  private async entryForSource(source: WordSource): Promise<LibraryEntry | null> {
    const result = await this.library.get(source.id);
    const entry = result.collection.entries?.find((item) => item.vocabularyId === this.wordId()) ?? null;
    if (!entry) this.snack.open('This word is no longer in that collection.', 'OK', { duration: 2500 });
    return entry;
  }

  private async refreshAfterManagedChange(): Promise<void> {
    await this.store.refreshAfterSubscriptionChange();
    if (!this.word()) {
      await this.router.navigate(['/words']);
      return;
    }
    await this.loadDetails();
  }
}
