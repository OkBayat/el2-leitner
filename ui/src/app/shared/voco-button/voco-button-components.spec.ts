import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatRipple } from '@angular/material/core';
import { provideRouter, Router } from '@angular/router';
import {
  VocoAudioButtonComponent,
  VocoButtonInteractionDirective,
  VocoErrorButtonComponent,
  VocoIconButtonComponent,
  VocoIconLinkComponent,
  VocoNavigationButtonComponent,
  VocoNavigationLinkComponent,
  VocoPrimaryButtonComponent,
  VocoPrimaryLinkComponent,
  VocoSecondaryButtonComponent,
  VocoSecondaryLinkComponent,
  VocoSuccessButtonComponent,
  VocoWarningButtonComponent,
} from './index';

@Component({
  standalone: true,
  template: '',
})
class EmptyRouteComponent {}

@Component({
  standalone: true,
  imports: [
    VocoAudioButtonComponent,
    VocoButtonInteractionDirective,
    VocoErrorButtonComponent,
    VocoIconButtonComponent,
    VocoIconLinkComponent,
    VocoNavigationButtonComponent,
    VocoNavigationLinkComponent,
    VocoPrimaryButtonComponent,
    VocoPrimaryLinkComponent,
    VocoSecondaryButtonComponent,
    VocoSecondaryLinkComponent,
    VocoSuccessButtonComponent,
    VocoWarningButtonComponent,
  ],
  template: `
    <div (click)="recordAncestorClick()">
      <voco-primary-button type="submit" aria-label="Save changes" (activated)="recordActivation()">Save</voco-primary-button>
    </div>
    <voco-secondary-button>Cancel</voco-secondary-button>
    <voco-success-button>Continue</voco-success-button>
    <voco-warning-button>Practice</voco-warning-button>
    <voco-error-button [disabled]="disabled" (activated)="recordActivation()">Delete</voco-error-button>
    <voco-navigation-button>Back</voco-navigation-button>
    <voco-primary-button class="textual-audio-action">Play pronunciation</voco-primary-button>
    <voco-icon-button aria-label="Edit word">✎</voco-icon-button>
    <voco-audio-button aria-label="Play pronunciation" [disabled]="disabled"><svg aria-hidden="true" /></voco-audio-button>
    <voco-primary-link href="/primary">Primary link</voco-primary-link>
    <voco-secondary-link href="https://example.com" target="_blank" rel="noopener">External</voco-secondary-link>
    <voco-navigation-link [routerLink]="['/library']">Library</voco-navigation-link>
    <voco-navigation-link data-testid="disabled-router-link" [routerLink]="['/library']" [disabled]="disabled" (activated)="recordActivation()">Disabled library</voco-navigation-link>
    <voco-icon-link href="/edit" aria-label="Edit link">✎</voco-icon-link>
    <voco-icon-link data-testid="disabled-icon-link" [routerLink]="['/library']" [disabled]="disabled" aria-label="Disabled edit link" (activated)="recordActivation()">✎</voco-icon-link>
    <button vocoButtonInteraction type="button">Selection</button>
  `,
})
class TestHostComponent {
  disabled = true;
  activations = 0;
  ancestorClicks = 0;

  recordActivation(): void {
    this.activations += 1;
  }

  recordAncestorClick(): void {
    this.ancestorClicks += 1;
  }
}

describe('public voco button components', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideRouter([{ path: 'library', component: EmptyRouteComponent }])],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it.each([
    ['primary', VocoPrimaryButtonComponent],
    ['secondary', VocoSecondaryButtonComponent],
    ['success', VocoSuccessButtonComponent],
    ['warning', VocoWarningButtonComponent],
    ['error', VocoErrorButtonComponent],
    ['navigation', VocoNavigationButtonComponent],
  ] as const)('maps the separate %s API to one fixed Material-backed intent', (intent, componentType) => {
    const host = fixture.debugElement.query(By.directive(componentType));
    const button = host.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.classList).toContain(`voco-button--${intent}`);
    expect(host.query(By.directive(MatButton))).not.toBeNull();
  });

  it('forwards native type and accessible naming', () => {
    const button = fixture.nativeElement.querySelector('voco-primary-button button') as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.getAttribute('aria-label')).toBe('Save changes');
    expect(button.textContent?.trim()).toBe('Save');
  });

  it('emits activated exactly once and lets the enabled native event bubble', () => {
    const button = fixture.nativeElement.querySelector('voco-primary-button button') as HTMLButtonElement;
    button.click();

    expect(fixture.componentInstance.activations).toBe(1);
    expect(fixture.componentInstance.ancestorClicks).toBe(1);
  });

  it('does not activate a disabled button from its host or native control', () => {
    const host = fixture.nativeElement.querySelector('voco-error-button') as HTMLElement;
    const button = host.querySelector('button') as HTMLButtonElement;
    host.click();
    button.click();

    expect(button.disabled).toBe(true);
    expect(fixture.componentInstance.activations).toBe(0);
  });

  it('keeps programmatic and keyboard focus on the native Material control', () => {
    const debug = fixture.debugElement.query(By.directive(VocoNavigationButtonComponent));
    debug.componentInstance.focus();

    expect(document.activeElement).toBe(debug.nativeElement.querySelector('button'));
  });

  it('preserves external and router-link anchor semantics', () => {
    const external = fixture.nativeElement.querySelector('voco-secondary-link a') as HTMLAnchorElement;
    const internal = fixture.nativeElement.querySelector('voco-navigation-link:not([data-testid]) a') as HTMLAnchorElement;

    expect(external.href).toBe('https://example.com/');
    expect(external.target).toBe('_blank');
    expect(external.rel).toBe('noopener');
    expect(external.textContent?.trim()).toBe('External');
    expect(internal.getAttribute('href')).toBe('/library');
    expect(internal.textContent?.trim()).toBe('Library');
  });

  it('removes href, routing, focus, and activation from a disabled link', () => {
    const host = fixture.nativeElement.querySelector('[data-testid="disabled-router-link"]') as HTMLElement;
    const anchor = host.querySelector('a') as HTMLAnchorElement;
    const router = TestBed.inject(Router);
    const mouse = new MouseEvent('click', { bubbles: true, cancelable: true });
    const keyboard = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    expect(anchor.getAttribute('href')).toBeNull();
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.tabIndex).toBe(-1);
    expect(anchor.dispatchEvent(mouse)).toBe(false);
    anchor.dispatchEvent(keyboard);
    const disabledIconAnchor = fixture.nativeElement.querySelector('[data-testid="disabled-icon-link"] a') as HTMLAnchorElement;
    expect(disabledIconAnchor.getAttribute('href')).toBeNull();
    expect(disabledIconAnchor.getAttribute('aria-disabled')).toBe('true');
    expect(disabledIconAnchor.tabIndex).toBe(-1);
    expect(disabledIconAnchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
    expect(fixture.componentInstance.activations).toBe(0);
    expect(router.url).toBe('/');
  });

  it('keeps icon, icon-link, and square audio controls Material-backed and accessible', () => {
    const icon = fixture.nativeElement.querySelector('voco-icon-button button') as HTMLButtonElement;
    const iconLink = fixture.nativeElement.querySelector('voco-icon-link a') as HTMLAnchorElement;
    const audio = fixture.nativeElement.querySelector('voco-audio-button button') as HTMLButtonElement;

    expect(fixture.debugElement.query(By.directive(VocoIconButtonComponent)).query(By.directive(MatIconButton)).nativeElement).toBe(icon);
    expect(fixture.debugElement.query(By.directive(VocoIconLinkComponent)).query(By.directive(MatIconButton)).nativeElement).toBe(iconLink);
    expect(fixture.debugElement.query(By.directive(VocoAudioButtonComponent)).query(By.directive(MatButton)).nativeElement).toBe(audio);
    expect(icon.getAttribute('aria-label')).toBe('Edit word');
    expect(iconLink.getAttribute('aria-label')).toBe('Edit link');
    expect(audio.getAttribute('aria-label')).toBe('Play pronunciation');
    expect(audio.classList).toContain('voco-audio-button');
  });

  it('keeps textual audio actions on the flexible textual component', () => {
    const host = fixture.nativeElement.querySelector('.textual-audio-action') as HTMLElement;
    expect(host.localName).toBe('voco-primary-button');
    expect(host.querySelector('button')?.classList).toContain('voco-button--primary');
    expect(host.querySelector('.voco-audio-button')).toBeNull();
  });

  it('keeps selection visuals on the narrow Material ripple directive', () => {
    const interaction = fixture.debugElement.query(By.directive(VocoButtonInteractionDirective));
    expect(interaction.injector.get(MatRipple)).toBeTruthy();
    expect(interaction.nativeElement.localName).toBe('button');
  });
});
