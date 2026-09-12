import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
} from "@angular/core";
import {
	VocoErrorButtonComponent,
	VocoPrimaryButtonComponent,
	VocoSuccessButtonComponent,
	VocoWarningButtonComponent,
} from "../../shared/voco-button";

export type ReviewFooterTone = "neutral" | "success" | "error" | "practice";

@Component({
	selector: "app-review-footer-primary-button",
	standalone: true,
	imports: [
		VocoErrorButtonComponent,
		VocoPrimaryButtonComponent,
		VocoSuccessButtonComponent,
		VocoWarningButtonComponent,
	],
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
			@case ("practice") {
				<voco-warning-button
					type="button"
					[disabled]="disabled()"
					(activated)="pressed.emit()"
				>
					{{ label() }}
				</voco-warning-button>
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
		voco-error-button,
		voco-warning-button {
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
