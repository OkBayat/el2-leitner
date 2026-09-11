import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
	MAT_DIALOG_DATA,
	MatDialogModule,
	MatDialogRef,
} from "@angular/material/dialog";
import { VocoButtonComponent } from "../voco-button";
export interface ConfirmDialogData {
	title: string;
	message: string;
	confirmLabel?: string;
	danger?: boolean;
}

@Component({
	selector: "app-confirm-dialog",
	imports: [MatDialogModule, VocoButtonComponent],
	template: `
		<h2 mat-dialog-title>{{ data.title }}</h2>
		<mat-dialog-content>{{ data.message }}</mat-dialog-content>
		<mat-dialog-actions align="end">
			<voco-secondary-button (activated)="dialog.close(false)"
				>Cancel</voco-secondary-button
			>
			@if (data.danger) {
				<voco-error-button (activated)="dialog.close(true)">{{
					data.confirmLabel || "Confirm"
				}}</voco-error-button>
			} @else {
				<voco-primary-button (activated)="dialog.close(true)">{{
					data.confirmLabel || "Confirm"
				}}</voco-primary-button>
			}
		</mat-dialog-actions>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
	readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
	readonly dialog = inject(MatDialogRef<ConfirmDialogComponent>);
}
