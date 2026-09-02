import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaInstallService } from './core/pwa/pwa-install.service';
import { PwaUpdateService } from './core/pwa/pwa-update.service';
import { PwaStatusComponent } from './shared/pwa/pwa-status.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaStatusComponent],
  template: '<app-pwa-status /><router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly pwaInstallation = inject(PwaInstallService);
  private readonly pwaUpdates = inject(PwaUpdateService);

  constructor() {
    // Instantiate the install service during bootstrap so Chromium's one-shot
    // beforeinstallprompt event is captured before the user opens Settings.
    void this.pwaInstallation.mode();
    this.pwaUpdates.start();
  }
}
