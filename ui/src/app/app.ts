import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaInstallService } from './core/pwa/pwa-install.service';
import { PwaUpdateService } from './core/pwa/pwa-update.service';
import { ThemeService } from './core/theme/theme.service';
import { PwaStatusComponent } from './shared/pwa/pwa-status.component';
import { NativeLifecycleService } from './core/platform/native-lifecycle.service';
import { AppUpdateService } from './core/update/app-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaStatusComponent],
  templateUrl: 'app.html',
  styleUrl: 'app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly pwaInstallation = inject(PwaInstallService);
  private readonly pwaUpdates = inject(PwaUpdateService);
  private readonly theme = inject(ThemeService);
  private readonly nativeLifecycle = inject(NativeLifecycleService);
  readonly appUpdates = inject(AppUpdateService);

  constructor() {
    // Keep theme and system chrome synchronized on routes outside AppShell.
    void this.theme;
    // Instantiate the install service during bootstrap so Chromium's one-shot
    // beforeinstallprompt event is captured before the user opens Settings.
    void this.pwaInstallation.mode();
    this.pwaUpdates.start();
    this.nativeLifecycle.start();
    this.appUpdates.start();
  }
}
