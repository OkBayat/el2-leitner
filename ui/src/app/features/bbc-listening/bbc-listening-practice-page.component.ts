import { listeningDifficultyLabel, listeningLevelLabel } from '../../domain/listening-practice/listening-practice';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { VocoButtonComponent } from '../../shared/voco-button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { ListeningAttemptService } from '../../application/listening-practice/listening-attempt.service';
import { ListeningMistakePracticeService } from '../../application/listening-practice/listening-mistake-practice.service';
import { normalizeAnswer } from '../../domain/learning/learning-rules';
import { listeningVocabularyCandidate } from '../../domain/listening-practice/listening-mistake-practice';
import {
  ListeningPromptParts,
  ListeningQuestionResult,
  countAnsweredListeningQuestions,
  splitListeningBlankPrompt,
} from '../../domain/listening-practice/listening-practice';
import { ListeningAudioPlayerComponent } from '../../shared/listening-audio-player/listening-audio-player.component';

@Component({
  selector: 'app-bbc-listening-practice-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    VocoButtonComponent,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    ListeningAudioPlayerComponent,
  ],
  templateUrl: 'bbc-listening-practice-page.component.html',
  styleUrl: 'bbc-listening-practice-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbcListeningPracticePageComponent implements OnInit {
  @Input() lessonSlug = '';
  @Input() testId = '';
  @Input() embedded = false;
  @Output() readonly attemptSubmitted = new EventEmitter<{ attemptId: string }>();

  readonly levelLabel = listeningLevelLabel;
  readonly difficultyLabel = listeningDifficultyLabel;
  readonly session = inject(ListeningAttemptService);
  readonly answers = new FormRecord<FormControl<string>>({});
  readonly routeError = signal<string | null>(null);
  readonly submitted = computed(() => this.session.result() !== null);
  readonly resultsByQuestion = computed(() => new Map(
    (this.session.result()?.results ?? []).map((result) => [result.questionId, result]),
  ));
  readonly answerValues = toSignal(
    this.answers.valueChanges.pipe(map(() => this.answers.getRawValue())),
    { initialValue: this.answers.getRawValue() },
  );
  readonly answeredCount = computed(() => {
    const test = this.session.test();
    return test ? countAnsweredListeningQuestions(test, this.answerValues()) : 0;
  });
  readonly canSubmit = computed(() => Boolean(
    this.session.lesson()
    && this.session.test()
    && !this.submitted()
    && !this.session.submitting()
    && !this.session.restarting(),
  ));
  readonly addingVocabulary = signal<string | null>(null);
  readonly addedVocabulary = signal<ReadonlySet<string>>(new Set());
  readonly existingHouseOneVocabulary = signal<ReadonlySet<string>>(new Set());
  readonly vocabularyError = signal<string | null>(null);

  private readonly route = inject(ActivatedRoute);
  private readonly mistakePractice = inject(ListeningMistakePracticeService);

  async ngOnInit(): Promise<void> {
    const lessonSlug = this.lessonSlug.trim() || this.route.snapshot.paramMap.get('lessonSlug')?.trim();
    const testId = this.testId.trim() || this.route.snapshot.paramMap.get('testId')?.trim();
    if (!lessonSlug || !testId) {
      this.routeError.set('The listening test could not be identified.');
      return;
    }
    const started = await this.session.start(lessonSlug, testId);
    const test = this.session.test();
    if (!started || !test) return;

    for (const group of test.groups) {
      for (const question of group.questions) {
        this.answers.addControl(question.id, new FormControl('', { nonNullable: true }));
      }
    }
  }

  answerControl(questionId: string): FormControl<string> {
    const control = this.answers.controls[questionId];
    if (!control) throw new Error(`Missing answer control for ${questionId}.`);
    return control;
  }

  promptParts(prompt: string): ListeningPromptParts {
    return splitListeningBlankPrompt(prompt);
  }

  resultFor(questionId: string): ListeningQuestionResult | null {
    return this.resultsByQuestion().get(questionId) ?? null;
  }

  vocabularyCandidate(result: ListeningQuestionResult): string | null {
    return listeningVocabularyCandidate(result);
  }

  isVocabularyInHouseOne(term: string): boolean {
    const normalized = normalizeAnswer(term);
    return this.existingHouseOneVocabulary().has(normalized) || this.addedVocabulary().has(normalized);
  }

  async addVocabularyToHouseOne(term: string): Promise<void> {
    if (this.addingVocabulary() || this.isVocabularyInHouseOne(term)) return;
    this.vocabularyError.set(null);
    this.addingVocabulary.set(term);
    try {
      await this.mistakePractice.addToHouseOne(term);
      this.addedVocabulary.update((current) => {
        const next = new Set(current);
        next.add(normalizeAnswer(term));
        return next;
      });
    } catch (error) {
      this.vocabularyError.set(error instanceof Error ? error.message : 'Could not add the answer to House 1.');
    } finally {
      this.addingVocabulary.set(null);
    }
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const submitted = await this.session.submit(this.answers.getRawValue());
    if (!submitted) return;

    await this.refreshHouseOneVocabularyStatus();
    const attemptId = String(this.session.result()?.attempt.id ?? '').trim();
    if (attemptId) this.attemptSubmitted.emit({ attemptId });
  }

  async retake(): Promise<void> {
    const restarted = await this.session.restart();
    if (!restarted) return;

    for (const control of Object.values(this.answers.controls)) {
      control.reset('');
    }
    this.addedVocabulary.set(new Set());
    this.existingHouseOneVocabulary.set(new Set());
    this.vocabularyError.set(null);
  }

  private async refreshHouseOneVocabularyStatus(): Promise<void> {
    const candidates = (this.session.result()?.results ?? [])
      .map((result) => this.vocabularyCandidate(result))
      .filter((term): term is string => Boolean(term));
    if (!candidates.length) {
      this.existingHouseOneVocabulary.set(new Set());
      return;
    }

    try {
      this.existingHouseOneVocabulary.set(await this.mistakePractice.findExistingHouseOneTerms(candidates));
    } catch (error) {
      this.existingHouseOneVocabulary.set(new Set());
      this.vocabularyError.set(error instanceof Error ? error.message : 'Could not check House 1 vocabulary status.');
    }
  }
}
