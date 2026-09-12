import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { VOCO_CONTROL_HOST, VocoButtonFoundation } from './voco-button-foundation';

@Component({
  selector: 'voco-primary-button',
  imports: [MatButtonModule],
  templateUrl: './voco-text-button.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_CONTROL_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoPrimaryButtonComponent extends VocoButtonFoundation {
  protected readonly intent = 'primary';
}

@Component({
  selector: 'voco-secondary-button',
  imports: [MatButtonModule],
  templateUrl: './voco-text-button.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_CONTROL_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoSecondaryButtonComponent extends VocoButtonFoundation {
  protected readonly intent = 'secondary';
}

@Component({
  selector: 'voco-success-button',
  imports: [MatButtonModule],
  templateUrl: './voco-text-button.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_CONTROL_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoSuccessButtonComponent extends VocoButtonFoundation {
  protected readonly intent = 'success';
}

@Component({
  selector: 'voco-warning-button',
  imports: [MatButtonModule],
  templateUrl: './voco-text-button.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_CONTROL_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoWarningButtonComponent extends VocoButtonFoundation {
  protected readonly intent = 'warning';
}

@Component({
  selector: 'voco-error-button',
  imports: [MatButtonModule],
  templateUrl: './voco-text-button.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_CONTROL_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoErrorButtonComponent extends VocoButtonFoundation {
  protected readonly intent = 'error';
}

@Component({
  selector: 'voco-navigation-button',
  imports: [MatButtonModule],
  templateUrl: './voco-text-button.component.html',
  styleUrl: './voco-button-foundation.component.scss',
  host: VOCO_CONTROL_HOST,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocoNavigationButtonComponent extends VocoButtonFoundation {
  protected readonly intent = 'navigation';
}
