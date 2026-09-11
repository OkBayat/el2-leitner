import { ComponentFixture, TestBed } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
	ReviewFooterPrimaryButtonComponent,
	type ReviewFooterTone,
} from "./review-footer-primary-button.component";

describe("ReviewFooterPrimaryButtonComponent", () => {
	function render(
		tone: ReviewFooterTone,
		disabled = false,
	): ComponentFixture<ReviewFooterPrimaryButtonComponent> {
		const fixture = TestBed.createComponent(
			ReviewFooterPrimaryButtonComponent,
		);
		fixture.componentRef.setInput("tone", tone);
		fixture.componentRef.setInput("label", "Continue");
		fixture.componentRef.setInput("disabled", disabled);
		fixture.detectChanges();
		return fixture;
	}

	it.each([
		["success", "voco-success-button"],
		["error", "voco-error-button"],
		["neutral", "voco-primary-button"],
		["practice", "voco-primary-button"],
	] as const)("renders %s through %s", (tone, selector) => {
		const fixture = render(tone);
		expect(
			(fixture.nativeElement as HTMLElement).querySelector(selector),
		).not.toBeNull();
	});

	it("emits once from an enabled action and not from a disabled action", () => {
		const enabled = render("success");
		const enabledPressed = vi.fn();
		enabled.componentInstance.pressed.subscribe(enabledPressed);
		enabled.nativeElement.querySelector("button")?.click();

		const disabled = render("error", true);
		const disabledPressed = vi.fn();
		disabled.componentInstance.pressed.subscribe(disabledPressed);
		disabled.nativeElement.querySelector("button")?.click();

		expect(enabledPressed).toHaveBeenCalledOnce();
		expect(disabledPressed).not.toHaveBeenCalled();
	});
});
