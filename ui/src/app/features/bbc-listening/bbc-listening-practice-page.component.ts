import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { ListeningAttemptService } from '../../application/listening-practice/listening-attempt.service';
import {
  ListeningPromptParts,
  ListeningQuestionResult,
  countAnsweredListeningQuestions,
  splitListeningBlankPrompt,
} from '../../domain/listening-practice/listening-practice';

@Component({
  selector: 'app-bbc-listening-practice-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
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
    const lesson = this.session.lesson();
    return lesson ? countAnsweredListeningQuestions(lesson, this.answerValues()) : 0;
  });
  readonly canSubmit = computed(() => {
    const lesson = this.session.lesson();
    return Boolean(
      lesson
      && !this.submitted()
      && !this.session.submitting()
      && this.answeredCount() === lesson.questionCount,
    );
  });

  private readonly route = inject(ActivatedRoute);

  async ngOnInit(): Promise<void> {
    const lessonSlug = this.route.snapshot.paramMap.get('lessonSlug')?.trim();
    if (!lessonSlug) {
      this.routeError.set('The listening lesson could not be identified.');
      return;
    }
    const started = await this.session.start(lessonSlug);
    const lesson = this.session.lesson();
    if (!started || !lesson) return;

    for (const group of lesson.groups) {
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

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    await this.session.submit(this.answers.getRawValue());
  }
}
