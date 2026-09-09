import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PracticeWordsSlideBuilderService } from '../../application/practice-words/practice-words-slide-builder.service';
import type { SelectionSlideExpansionHandler } from '../../shared/slide-exercise';
import type { ExerciseContext } from '../collection-learning-path/exercises/exercise-runtime/exercise-contracts';
import { SlidesSequenceExerciseComponent } from '../collection-learning-path/exercises/slides-sequence/slides-sequence-exercise.component';

@Component({
  selector: 'app-practice-words-page',
  standalone: true,
  imports: [SlidesSequenceExerciseComponent],
  template: '<app-slides-sequence-exercise (outcome)="onOutcome()" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeWordsPageComponent implements OnInit {
  @ViewChild(SlidesSequenceExerciseComponent, { static: true })
  private readonly exercise!: SlidesSequenceExerciseComponent;
  private readonly router = inject(Router);
  private readonly slideBuilder = inject(PracticeWordsSlideBuilderService);
  private readonly expandPracticeMode: SelectionSlideExpansionHandler = async (request) => {
    if (request.expansionId !== 'house-one-practice') {
      throw new Error(`Unsupported selection expansion: ${request.expansionId}`);
    }
    if (request.selectedOptionIds.length !== 1) {
      throw new Error('Choose exactly one practice mode.');
    }
    return {
      slides: await this.slideBuilder.build(
        request.slideId,
        request.selectedOptionIds[0],
      ),
    };
  };

  readonly exerciseContext: ExerciseContext = {
    pathId: 'standalone-practice',
    lessonId: 'practice-words',
    exerciseId: 'choose-practice-mode',
    type: 'slides.sequence',
    schemaVersion: 1,
    completionPolicy: 'slide-sequence',
    payload: null,
    selectionExpansion: this.expandPracticeMode,
    config: {
      slides: [
        {
          id: 'practice-mode',
          type: 'selection',
          data: {
            mode: 'single',
            expansionId: 'house-one-practice',
            instruction: 'Choose how you want to practice.',
            question: 'Select a practice mode',
            options: [
              { id: 'vocabulary-dictation', label: 'Vocabulary Dictation', description: 'Hear a word or collocation and type it.' },
              { id: 'sentence-completion', label: 'Sentence Completion', description: 'Hear the missing word or collocation and complete the sentence.' },
              { id: 'sentence-shadowing', label: 'Sentence Shadowing', description: 'Hear a complete sentence and repeat it.' },
            ],
          },
          chrome: {
            header: { progress: null },
          },
        },
        {
          id: 'finish',
          type: 'summary',
          terminal: true,
          data: {
            aggregationMode: 'first-attempts',
            eyebrow: 'Practice complete',
            title: 'Every House 1 word has been practiced',
            subtitle: 'Review your first-attempt results.',
          },
          chrome: {
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

  onOutcome(): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
