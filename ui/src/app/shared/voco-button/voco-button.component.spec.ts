import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatRipple } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { VocoButtonInteractionDirective } from './voco-button-interaction.directive';
import { VocoButtonComponent } from './voco-button.component';

@Component({
  standalone: true,
  imports: [VocoButtonComponent, VocoButtonInteractionDirective],
  template: `
    <voco-primary-button type="submit" aria-label="Save changes" (click)="recordClick()">Save</voco-primary-button>
    <voco-secondary-button>Cancel</voco-secondary-button>
    <voco-success-button>Continue</voco-success-button>
    <voco-warning-button>Leave</voco-warning-button>
    <voco-error-button [disabled]="disabled" (click)="recordClick()">Delete</voco-error-button>
    <voco-navigation-button>Back</voco-navigation-button>
    <voco-primary-button data-testid="dynamic-intent" intent="success">Dynamic</voco-primary-button>
    <voco-secondary-link href="https://example.com" target="_blank" rel="noopener">External</voco-secondary-link>
    <voco-navigation-link [routerLink]="['/library']">Library</voco-navigation-link>
    <button vocoButtonInteraction type="button">Selection</button>
  `,
})
class TestHostComponent {
  disabled = true;
  clicks = 0;

  recordClick(): void {
    this.clicks += 1;
  }
}

describe('VocoButtonComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders all six semantic variants on one Material-backed foundation', () => {
    const variants = ['primary', 'secondary', 'success', 'warning', 'error', 'navigation'];

    for (const variant of variants) {
      const host = fixture.nativeElement.querySelector(`voco-${variant}-button`);
      const button = host.querySelector('button');
      expect(button?.textContent.trim()).toBeTruthy();
      expect(button?.classList).toContain(`voco-button--${variant}`);
      expect(fixture.debugElement.queryAll(By.directive(MatButton))).toContain(
        fixture.debugElement.query(By.css(`voco-${variant}-button button`)),
      );
    }
  });

  it('forwards native type and accessible naming', () => {
    const button = fixture.nativeElement.querySelector('voco-primary-button button') as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.getAttribute('aria-label')).toBe('Save changes');
  });

  it('supports a view-model-driven semantic intent on a stable action owner', () => {
    const button = fixture.nativeElement.querySelector('[data-testid="dynamic-intent"] button');
    expect(button.classList).toContain('voco-button--success');
  });

  it('preserves native external and router-link anchor semantics', () => {
    const external = fixture.nativeElement.querySelector('voco-secondary-link a') as HTMLAnchorElement;
    const internal = fixture.nativeElement.querySelector('voco-navigation-link a') as HTMLAnchorElement;

    expect(external.href).toBe('https://example.com/');
    expect(external.target).toBe('_blank');
    expect(external.rel).toBe('noopener');
    expect(internal.getAttribute('href')).toBe('/library');
  });

  it('bubbles one enabled click and blocks disabled activation', () => {
    const primary = fixture.nativeElement.querySelector('voco-primary-button') as HTMLElement;
    const error = fixture.nativeElement.querySelector('voco-error-button button') as HTMLButtonElement;

    primary.click();
    error.click();

    expect(fixture.componentInstance.clicks).toBe(1);
    expect(error.disabled).toBe(true);
  });

  it('keeps keyboard focus on the native Material button', () => {
    const button = fixture.nativeElement.querySelector('voco-navigation-button button') as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('keeps specialized selection visuals on a Material ripple foundation', () => {
    const interaction = fixture.debugElement.query(By.directive(VocoButtonInteractionDirective));
    expect(interaction.injector.get(MatRipple)).toBeTruthy();
    expect(interaction.nativeElement.localName).toBe('button');
  });
});
