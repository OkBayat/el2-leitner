import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { VOCO_LINK_HOST, VocoLinkFoundation } from './voco-link-foundation';

@Component({
  selector: 'voco-primary-link',
  imports: [NgTemplateOutlet, MatButtonModule, RouterLink],
  templateUrl: './voco-link.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_LINK_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoPrimaryLinkComponent extends VocoLinkFoundation {
  protected readonly intent = 'primary';
}

@Component({
  selector: 'voco-secondary-link',
  imports: [NgTemplateOutlet, MatButtonModule, RouterLink],
  templateUrl: './voco-link.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_LINK_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoSecondaryLinkComponent extends VocoLinkFoundation {
  protected readonly intent = 'secondary';
}

@Component({
  selector: 'voco-navigation-link',
  imports: [NgTemplateOutlet, MatButtonModule, RouterLink],
  templateUrl: './voco-link.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_LINK_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoNavigationLinkComponent extends VocoLinkFoundation {
  protected readonly intent = 'navigation';
}
