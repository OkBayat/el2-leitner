import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ShortcutClickDirective } from './shortcut-click.directive';
import { VocoPrimaryButtonComponent } from './voco-button';

@Component({
	standalone: true,
	imports: [ShortcutClickDirective],
	template: `
		<button
			type="button"
			appShortcutClick="Alt+R"
			[disabled]="disabled"
			(click)="clicks += 1"
		>
			Replay
		</button>
	`,
})
class ShortcutClickTestHostComponent {
	clicks = 0;
	disabled = false;
}

@Component({
	standalone: true,
	imports: [ShortcutClickDirective, VocoPrimaryButtonComponent],
	template: `
		<div (click)="ancestorClicks += 1">
			<voco-primary-button
				appShortcutClick="Alt+R"
				[disabled]="disabled"
				(activated)="clicks += 1"
			>
				Replay
			</voco-primary-button>
		</div>
	`,
})
class VocoShortcutClickTestHostComponent {
	clicks = 0;
	ancestorClicks = 0;
	disabled = false;
}

describe('ShortcutClickDirective', () => {
	it('activates the native control inside a voco host and preserves event bubbling', () => {
		const fixture = TestBed.createComponent(VocoShortcutClickTestHostComponent);
		fixture.detectChanges();

		document.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'r', altKey: true, bubbles: true, cancelable: true,
		}));

		expect(fixture.componentInstance.clicks).toBe(1);
		expect(fixture.componentInstance.ancestorClicks).toBe(1);

		fixture.componentInstance.disabled = true;
		fixture.detectChanges();
		document.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'r', altKey: true, bubbles: true, cancelable: true,
		}));
		expect(fixture.componentInstance.clicks).toBe(1);
		expect(fixture.componentInstance.ancestorClicks).toBe(1);
	});

	it('clicks its enabled host for the configured keyboard shortcut', () => {
		const fixture = TestBed.createComponent(ShortcutClickTestHostComponent);
		fixture.detectChanges();

		const button = fixture.nativeElement.querySelector(
			'button',
		) as HTMLButtonElement;
		expect(button.getAttribute('aria-keyshortcuts')).toBe('Alt+R');

		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'r',
				altKey: true,
				bubbles: true,
				cancelable: true,
			}),
		);

		expect(fixture.componentInstance.clicks).toBe(1);
	});

	it('ignores unrelated shortcuts and disabled hosts', () => {
		const fixture = TestBed.createComponent(ShortcutClickTestHostComponent);
		fixture.detectChanges();

		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'p',
				altKey: true,
				bubbles: true,
			}),
		);
		expect(fixture.componentInstance.clicks).toBe(0);

		fixture.componentInstance.disabled = true;
		fixture.detectChanges();
		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'r',
				altKey: true,
				bubbles: true,
			}),
		);
		expect(fixture.componentInstance.clicks).toBe(0);
	});
});
