import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SlideExerciseHeaderComponent } from './slide-exercise-header.component';

describe('SlideExerciseHeaderComponent', () => {
  it('renders Material icon-button chrome and keeps progress copy out of the progress row', () => {
    TestBed.configureTestingModule({ imports: [SlideExerciseHeaderComponent] });
    const fixture = TestBed.createComponent(SlideExerciseHeaderComponent);
    fixture.componentRef.setInput('progress', { value: 25, label: 'Word 2 of 8' });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const header = element.querySelector('.slide-exercise-header');
    const close = element.querySelector<HTMLButtonElement>('[aria-label="Close exercise"]');
    const progress = element.querySelector('.slide-exercise-header__progress');
    const copy = element.querySelector('.slide-exercise-header__copy');

    expect(close?.querySelector('.mat-mdc-icon-button')).not.toBeNull();
    expect(progress?.parentElement).toBe(header);
    expect(copy?.parentElement).toBe(header);
    expect(copy?.previousElementSibling).toBe(progress);
  });
});
