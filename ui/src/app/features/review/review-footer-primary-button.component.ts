import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
} from "@angular/core";
import { VocoButtonComponent } from "../../shared/voco-button";

export type ReviewFooterTone = "neutral" | "success" | "error" | "practice";

@Component({
	selector: "app-review-footer-primary-button",
	standalone: true,
	imports: [VocoButtonComponent],
	template: `
		@switch (tone()) {
			@case ("success") {
				<voco-success-button
					type="button"
					[disabled]="disabled()"
					(activated)="pressed.emit()"
				>
					{{ label() }}
				</voco-success-button>
			}
			@case ("error") {
				<voco-error-button
					type="button"
					[disabled]="disabled()"
					(activated)="pressed.emit()"
				>
					{{ label() }}
				</voco-error-button>
			}
			@default {
				<voco-primary-button
					type="button"
					[disabled]="disabled()"
					(activated)="pressed.emit()"
				>
					{{ label() }}
				</voco-primary-button>
			}
		}
	`,
	styles: `
		:host,
		voco-primary-button,
		voco-success-button,
		voco-error-button {
			display: inline-block;
			width: 100%;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewFooterPrimaryButtonComponent {
	readonly tone = input.required<ReviewFooterTone>();
	readonly label = input.required<string>();
	readonly disabled = input(false);
	readonly pressed = output<void>();
}
