import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VocoNavigationLinkComponent, VocoPrimaryButtonComponent, VocoSecondaryButtonComponent } from '../../shared/voco-button';
import { ListeningVocabularyService } from '../../application/listening-practice/listening-vocabulary.service';
import { SpeechService } from '../../core/speech/speech.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ListeningVocabularyEntry, ListeningVocabularyResponse, listeningLevelLabel } from '../../domain/listening-practice/listening-practice';

@Component({
  selector: 'app-bbc-episode-vocabulary-page',
  imports: [RouterLink, VocoNavigationLinkComponent, VocoPrimaryButtonComponent, VocoSecondaryButtonComponent],
  templateUrl: 'bbc-episode-vocabulary-page.component.html',
  styleUrl: 'bbc-episode-vocabulary-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbcEpisodeVocabularyPageComponent implements OnInit {
  private readonly service = inject(ListeningVocabularyService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly speech = inject(SpeechService);
  private readonly store = inject(LearningStoreService);
  private request = 0;
  readonly slug = signal('');
  readonly vocabulary = signal<ListeningVocabularyResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly levelLabel = listeningLevelLabel;
  readonly newCount = computed(() => this.vocabulary()?.entries.filter((entry) => entry.progress.state === 'new').length ?? 0);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => { this.request += 1; this.speech.cancel(); });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.slug.set(params.get('lessonSlug') || '');
      void this.load();
    });
  }

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true); this.error.set(null); this.vocabulary.set(null); this.message.set(null);
    try {
      if (!this.slug()) throw new Error('The episode could not be identified.');
      const result = await this.service.load(this.slug());
      if (request === this.request) this.vocabulary.set(result);
    } catch (error) {
      if (request === this.request) this.error.set(error instanceof Error ? error.message : 'Episode vocabulary could not be loaded.');
    } finally { if (request === this.request) this.loading.set(false); }
  }

  async add(entry?: ListeningVocabularyEntry): Promise<void> {
    if (this.saving() || (entry && entry.progress.state !== 'new')) return;
    const request = this.request;
    this.saving.set(true); this.error.set(null); this.message.set(null);
    try {
      const result = await this.service.add(this.slug(), entry ? [entry.vocabularyId] : undefined);
      if (request === this.request) {
        this.vocabulary.set(result.vocabulary);
        this.message.set(result.added ? `${result.added} ${result.added === 1 ? 'word added' : 'words added'} to Leitner Box 1.` : 'These words are already in your Leitner box.');
      }
    } catch (error) {
      if (request === this.request) this.error.set(error instanceof Error ? error.message : 'Vocabulary could not be added.');
    } finally { this.saving.set(false); }
  }

  pronounce(entry: ListeningVocabularyEntry): void {
    if (!this.speech.speak(entry.term, this.store.state()?.settings.voiceRate ?? 0.85)) {
      this.error.set('Pronunciation is not available in this browser.');
    }
  }

  status(entry: ListeningVocabularyEntry): string {
    if (entry.progress.state === 'mastered') return 'Mastered';
    if (entry.progress.state === 'excluded') return 'Hidden from your word bank';
    return entry.progress.box > 0 ? `In Leitner Box ${entry.progress.box}` : 'Already added';
  }
}
