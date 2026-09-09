import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { ExerciseContext, ExerciseOutcome } from '../collection-learning-path/exercises/exercise-runtime/exercise-contracts';
import { SlidesSequenceExerciseComponent } from '../collection-learning-path/exercises/slides-sequence/slides-sequence-exercise.component';

@Component({
  selector: 'app-practice-words-page',
  standalone: true,
  imports: [SlidesSequenceExerciseComponent],
  template: `
    <app-slides-sequence-exercise (outcome)="onOutcome($event)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeWordsPageComponent implements OnInit {
  @ViewChild(SlidesSequenceExerciseComponent, { static: true })
  private readonly exercise!: SlidesSequenceExerciseComponent;
  private readonly router = inject(Router);

  readonly exerciseContext: ExerciseContext = {
    pathId: 'standalone-practice',
    lessonId: 'practice-words',
    exerciseId: 'choose-practice-mode',
    type: 'slides.sequence',
    schemaVersion: 1,
    completionPolicy: 'slide-sequence',
    payload: null,
    config: {
      slides: [
        {
          id: 'practice-mode',
          type: 'practice-mode-selection',
          data: {
            instruction: 'Choose how you want to practice.',
            question: 'Select a practice mode',
            options: [
              {
                id: 'vocabulary-dictation',
                label: 'Vocabulary Dictation',
                description: 'Hear a word or collocation and type it.',
              },
              {
                id: 'sentence-completion',
                label: 'Sentence Completion',
                description: 'Hear the missing word or collocation and complete the sentence.',
              },
              {
                id: 'sentence-shadowing',
                label: 'Sentence Shadowing',
                description: 'Hear a complete sentence and repeat it.',
              },
            ],
          },
        },
        {
          id: 'finish',
          type: 'summary',
          terminal: true,
          data: { eyebrow: '', title: '', subtitle: '', metrics: [] },
          chrome: {
            header: { visible: false },
            footer: {
              primary: { id: 'finish', label: 'Finish', behavior: 'emit' },
              secondary: false,
            },
          },
        },
      ],
    },
  };

  ngOnInit(): void {
    this.exercise.load(this.exerciseContext);
  }

  onOutcome(_outcome: ExerciseOutcome): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
