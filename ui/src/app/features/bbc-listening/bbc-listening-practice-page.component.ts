import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
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
import { ListeningAudioPlayerComponent } from './listening-audio-player.component';

@Component({
  selector: 'app-bbc-listening-practice-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
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
  readonly vocabularyError = signal<string | null>(null);

  private readonly route = inject(ActivatedRoute);
  private readonly mistakePractice = inject(ListeningMistakePracticeService);
  private readonly audioPlayer = viewChild(ListeningAudioPlayerComponent);

  async ngOnInit(): Promise<void> {
    const lessonSlug = this.route.snapshot.paramMap.get('lessonSlug')?.trim();
    const testId = this.route.snapshot.paramMap.get('testId')?.trim();
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

  isVocabularyAdded(term: string): boolean {
    return this.addedVocabulary().has(normalizeAnswer(term));
  }

  async addVocabularyToHouseOne(term: string): Promise<void> {
    if (this.addingVocabulary() || this.isVocabularyAdded(term)) return;
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
    await this.session.submit(this.answers.getRawValue());
  }

  async retake(): Promise<void> {
    const restarted = await this.session.restart();
    if (!restarted) return;

    for (const control of Object.values(this.answers.controls)) {
      control.reset('');
    }
    this.vocabularyError.set(null);
    this.audioPlayer()?.stop();
  }
}
