export interface MultipleChoiceSlideOption {
  readonly id: string;
  readonly label: string;
}

export interface MultipleChoiceSlideData {
  readonly instruction?: string;
  readonly prompt: string;
  readonly options: readonly MultipleChoiceSlideOption[];
  readonly correctOptionId: string;
  readonly correctTitle?: string;
  readonly incorrectTitle?: string;
}

export interface MultipleChoiceAnswerEvent {
  readonly selectedOptionId: string;
  readonly correctOptionId: string;
  readonly correct: boolean;
}
