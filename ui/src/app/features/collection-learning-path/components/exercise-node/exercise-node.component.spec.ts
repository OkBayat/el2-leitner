import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { LearningPathExerciseView } from '../../../../domain/collection-learning-path/learning-path';
import { ExerciseNodeComponent } from './exercise-node.component';

const exercise: LearningPathExerciseView = { id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {}, state: 'available', progress: null };

describe('ExerciseNodeComponent', () => {
  it('renders an accessible activity node and emits activation only for actionable states', () => {
    TestBed.configureTestingModule({ imports: [ExerciseNodeComponent] });
    const fixture = TestBed.createComponent(ExerciseNodeComponent);
    fixture.componentRef.setInput('exercise', exercise); fixture.detectChanges();
    const activated = vi.fn(); fixture.componentInstance.activate.subscribe(activated);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('data-state')).toBe('available');
    expect(button.getAttribute('data-kind')).toBe('vocabulary');
    expect(button.getAttribute('data-exercise-type')).toBe('vocabulary.intake');
    expect(button.querySelector('.exercise-node__icon')).not.toBeNull();
    button.click(); expect(activated).toHaveBeenCalledWith('exercise-1');
    fixture.componentRef.setInput('exercise', { ...exercise, state: 'locked' }); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses the listening activity family for IELTS nodes', () => {
    TestBed.configureTestingModule({ imports: [ExerciseNodeComponent] });
    const fixture = TestBed.createComponent(ExerciseNodeComponent);
    fixture.componentRef.setInput('exercise', { ...exercise, id: 'exercise-2', type: 'listening.ielts' }); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).getAttribute('data-kind')).toBe('listening');
  });
});
