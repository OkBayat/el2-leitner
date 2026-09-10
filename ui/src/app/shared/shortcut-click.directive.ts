import {
	Directive,
	ElementRef,
	HostBinding,
	HostListener,
	Input,
	inject,
} from '@angular/core';

@Directive({
	selector: '[appShortcutClick]',
	standalone: true,
})
export class ShortcutClickDirective {
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	@Input({ required: true }) appShortcutClick = '';

	@HostBinding('attr.aria-keyshortcuts')
	get ariaKeyShortcuts(): string {
		return this.appShortcutClick;
	}

	@HostListener('document:keydown', ['$event'])
	handleKeydown(event: KeyboardEvent): void {
		if (
			event.defaultPrevented ||
			event.repeat ||
			this.isDisabled() ||
			!this.matches(event)
		) {
			return;
		}

		event.preventDefault();
		this.host.nativeElement.click();
	}

	private isDisabled(): boolean {
		const element = this.host.nativeElement;
		return (
			element.matches(':disabled') ||
			element.getAttribute('aria-disabled') === 'true'
		);
	}

	private matches(event: KeyboardEvent): boolean {
		const parts = this.appShortcutClick
			.split('+')
			.map((part) => part.trim().toLowerCase())
			.filter(Boolean);
		const key = parts.pop();
		const modifiers = new Set(parts);

		return (
			Boolean(key) &&
			event.key.toLowerCase() === key &&
			event.altKey === modifiers.has('alt') &&
			event.ctrlKey === modifiers.has('ctrl') &&
			event.metaKey === modifiers.has('meta') &&
			event.shiftKey === modifiers.has('shift')
		);
	}
}
