import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButton, MatIconButton } from '@angular/material/button';
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
    <voco-icon-button aria-label="Edit word">✎</voco-icon-button>
    <voco-audio-button aria-label="Play pronunciation" [disabled]="disabled">▶</voco-audio-button>
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

  it('preserves native external and router-link anchor semantics', () => {
    const external = fixture.nativeElement.querySelector('voco-secondary-link a') as HTMLAnchorElement;
    const internal = fixture.nativeElement.querySelector('voco-navigation-link a') as HTMLAnchorElement;

    expect(external.href).toBe('https://example.com/');
    expect(external.target).toBe('_blank');
    expect(external.rel).toBe('noopener');
    expect(internal.getAttribute('href')).toBe('/library');
  });

  it('emits one public click from the native control and blocks disabled activation', () => {
    const primary = fixture.nativeElement.querySelector('voco-primary-button button') as HTMLButtonElement;
    const errorHost = fixture.nativeElement.querySelector('voco-error-button') as HTMLElement;
    const error = errorHost.querySelector('button') as HTMLButtonElement;

    primary.click();
    error.click();

    expect(fixture.componentInstance.clicks).toBe(1);
    expect(errorHost.getAttribute('aria-disabled')).toBe('true');
    expect(errorHost.classList).toContain('voco-button-host--disabled');
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

  it('keeps icon and audio controls Material-backed, accessible, disabled, and touch-sized', () => {
    const icon = fixture.nativeElement.querySelector('voco-icon-button button') as HTMLButtonElement;
    const audio = fixture.nativeElement.querySelector('voco-audio-button button') as HTMLButtonElement;

    expect(fixture.debugElement.query(By.directive(MatIconButton)).nativeElement).toBe(icon);
    expect(fixture.debugElement.queryAll(By.directive(MatButton)).some((item) => item.nativeElement === audio)).toBe(true);
    expect(icon.getAttribute('aria-label')).toBe('Edit word');
    expect(audio.getAttribute('aria-label')).toBe('Play pronunciation');
    expect(audio.disabled).toBe(true);
    expect(icon.classList).toContain('voco-icon-button');
    expect(audio.classList).toContain('voco-audio-button');
  });
});
