import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateService } from './core/pwa/pwa-update.service';
import { PwaStatusComponent } from './shared/pwa/pwa-status.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaStatusComponent],
  template: '<app-pwa-status /><router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly pwaUpdates = inject(PwaUpdateService);

  constructor() {
    this.pwaUpdates.start();
  }
}
