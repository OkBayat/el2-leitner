import { Directive } from '@angular/core';
import { MatRipple } from '@angular/material/core';

/**
 * Material-backed interaction for feature-owned selection controls whose visual
 * semantics intentionally differ from the voco CTA family.
 */
@Directive({
  selector: 'button[vocoButtonInteraction]',
  standalone: true,
  hostDirectives: [MatRipple],
})
export class VocoButtonInteractionDirective {}
