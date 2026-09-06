import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { OverlayContainer } from '@angular/cdk/overlay';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SentencePracticePrompt } from '../../domain/sentence-practice/sentence-practice';
import { SentenceAnswerComponent } from './sentence-answer.component';

function prompt(): SentencePracticePrompt {
	return {
		card: {
			id: 'w1', term: 'stationery', accepted: ['stationery', 'a much longer accepted alias'], box: 1, mistakes: 0,
			definitions: [{ id: 'd1', text: 'Materials for writing.', languageCode: 'en', collectionTitle: 'Campus vocabulary' }],
			sentences: [],
		},
		sentence: { id: 's1', text: 'The shop sells stationery.', before: 'The shop sells ', after: '.', category: 'General', sourceItemNumber: null, variantNumber: null },
		primary: true, retryNumber: 0,
	};
}

describe('SentenceAnswerComponent', () => {
	let fixture: ComponentFixture<SentenceAnswerComponent>;
	let control: FormControl<string>;
	let field: HTMLTextAreaElement;
	let overlay: HTMLElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [SentenceAnswerComponent] }).compileComponents();
		fixture = TestBed.createComponent(SentenceAnswerComponent);
		control = new FormControl('', { nonNullable: true });
		fixture.componentRef.setInput('control', control);
		fixture.componentRef.setInput('prompt', prompt());
		fixture.detectChanges();
		await fixture.whenStable();
		field = fixture.nativeElement.querySelector('textarea');
		overlay = TestBed.inject(OverlayContainer).getContainerElement();
	});

	afterEach(() => fixture.destroy());

	function enableDetails(): void {
		fixture.componentRef.setInput('readOnly', true);
		fixture.componentRef.setInput('revealed', true);
		fixture.detectChanges();
	}

	async function open(): Promise<HTMLElement> {
		enableDetails();
		fixture.componentInstance.focus();
		field.click();
		fixture.detectChanges();
		await fixture.whenStable();
		return overlay.querySelector('[role="dialog"]') as HTMLElement;
	}

	it('renders one textarea with mobile spelling controls and no input element', () => {
		expect(field.tagName).toBe('TEXTAREA');
		expect(field.rows).toBe(1);
		expect(fixture.nativeElement.querySelector('input')).toBeNull();
		for (const [name, value] of Object.entries({ autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' })) {
			expect(field.getAttribute(name)).toBe(value);
		}
		expect(fixture.nativeElement.querySelector('[data-testid="sentence-answer-measure"]').textContent).toBe('stationery');
	});

	it('measures the exact sentence alias rather than the longest accepted spelling', () => {
		const next = prompt();
		next.card.term = 'colour';
		next.sentence = { ...next.sentence, text: 'The color is blue.', before: 'The ', after: ' is blue.' };
		fixture.componentRef.setInput('prompt', next);
		fixture.detectChanges();
		expect(fixture.componentInstance.missingWord).toBe('color');
	});

	it('preserves two-way editing and folds pasted line breaks without losing phrase spaces', () => {
		field.value = 'make a\ndecision';
		field.dispatchEvent(new Event('input', { bubbles: true }));
		fixture.detectChanges();
		expect(control.value).toBe('make a decision');
		expect(field.value).toBe('make a decision');
	});

	it('does not submit while the mobile keyboard is composing or while Enter repeats', () => {
		const primary = vi.fn();
		fixture.componentInstance.primary.subscribe(primary);
		field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
		field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true }));
		field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
		expect(primary).not.toHaveBeenCalled();
		const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		field.dispatchEvent(enter);
		expect(primary).toHaveBeenCalledTimes(1);
		expect(enter.defaultPrevented).toBe(true);
	});

	it('keeps the answer visible and read-only during feedback', () => {
		control.setValue('stationary');
		fixture.componentRef.setInput('readOnly', true);
		fixture.componentRef.setInput('incorrect', true);
		fixture.detectChanges();
		expect(field.value).toBe('stationary');
		expect(field.readOnly).toBe(true);
		expect(field.getAttribute('aria-invalid')).toBe('true');
	});

	it('keeps word meaning unavailable until the checked answer is revealed and locked', async () => {
		field.click();
		fixture.detectChanges();
		await fixture.whenStable();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
		expect(overlay.querySelector('[role="dialog"]')).toBeNull();
		expect(field.getAttribute('aria-haspopup')).toBeNull();
		expect(field.getAttribute('title')).toBeNull();

		const beforeCheckShortcut = new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true });
		field.dispatchEvent(beforeCheckShortcut);
		fixture.detectChanges();
		expect(beforeCheckShortcut.defaultPrevented).toBe(false);
		expect(fixture.componentInstance.detailsOpen()).toBe(false);

		fixture.componentRef.setInput('readOnly', true);
		fixture.detectChanges();
		field.click();
		fixture.detectChanges();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
		expect(overlay.querySelector('[role="dialog"]')).toBeNull();

		fixture.componentRef.setInput('revealed', true);
		fixture.detectChanges();
		expect(field.getAttribute('aria-haspopup')).toBe('dialog');
		field.click();
		fixture.detectChanges();
		await fixture.whenStable();
		expect(fixture.componentInstance.detailsOpen()).toBe(true);
		expect(overlay.querySelector('[role="dialog"] mark')?.textContent).toBe('stationery');

		fixture.componentRef.setInput('readOnly', false);
		fixture.detectChanges();
		await fixture.whenStable();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
		expect(overlay.querySelector('[role="dialog"]')).toBeNull();
	});

	it('opens after check without stealing focus and displays real definitions and provenance', async () => {
		fixture.componentInstance.focus();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
		const panel = await open();
		expect(document.activeElement).toBe(field);
		expect(panel.textContent).toContain('Materials for writing.');
		expect(panel.textContent).toContain('Campus vocabulary');
		expect(panel.querySelector('mark')?.textContent).toBe('stationery');
	});

	it('supports keyboard opening, Escape, outside click and explicit close after check', async () => {
		enableDetails();
		field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }));
		fixture.detectChanges();
		expect(fixture.componentInstance.detailsOpen()).toBe(true);
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		fixture.detectChanges();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
		expect(document.activeElement).toBe(field);
		const panel = await open();
		(panel.querySelector('button') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
		await open();
		document.body.click();
		fixture.detectChanges();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
	});

	it('treats the safety gutter as outside without dismissing clicks on definition content', async () => {
		const panel = await open();
		(panel.querySelector('.definition-list p') as HTMLElement).click();
		fixture.detectChanges();
		expect(fixture.componentInstance.detailsOpen()).toBe(true);
		const frame = overlay.querySelector('[data-testid="sentence-word-details-frame"]') as HTMLElement;
		expect(frame).not.toBeNull();
		frame.click();
		fixture.detectChanges();
		expect(fixture.componentInstance.detailsOpen()).toBe(false);
		expect(control.value).toBe('');
	});

	it('closes stale details on the next prompt and renders definition text safely', async () => {
		const next = prompt();
		next.card.definitions![0].text = '<img src=x onerror=alert(1)>';
		fixture.componentRef.setInput('prompt', next);
		fixture.detectChanges();
		const panel = await open();
		expect(panel.querySelector('img')).toBeNull();
		expect(panel.textContent).toContain('<img src=x onerror=alert(1)>');
		fixture.componentRef.setInput('prompt', prompt());
		fixture.detectChanges();
		expect(overlay.querySelector('[role="dialog"]')).toBeNull();
	});

	it('shows an honest empty state for older decks without definitions', async () => {
		const next = prompt();
		delete next.card.definitions;
		fixture.componentRef.setInput('prompt', next);
		fixture.detectChanges();
		expect((await open()).textContent).toContain('No definition is available');
	});
});
