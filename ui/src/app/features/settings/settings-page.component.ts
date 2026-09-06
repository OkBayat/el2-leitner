import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LearningSettingsService } from '../../application/settings/learning-settings.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ThemeService } from '../../core/theme/theme.service';
import { createWord, ensureDailyWords, hydrateState, localDay } from '../../domain/learning/learning-rules';
import { LearningState, ThemeMode } from '../../domain/learning/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PwaInstallCardComponent } from '../../shared/pwa/pwa-install-card.component';

@Component({
  selector: 'app-settings-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    PwaInstallCardComponent,
  ],
  template: `
    <section class="page">
      <header>
        <h1>Settings</h1>
        <p>Fit the review plan to your schedule.</p>
      </header>

      <div class="grid">
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Daily plan</mat-card-title></mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" class="form">
              <mat-form-field appearance="outline">
                <mat-label>New words per day</mat-label>
                <input matInput type="number" min="1" max="50" formControlName="dailyNew">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Daily answer goal</mat-label>
                <input matInput type="number" min="5" max="200" formControlName="dailyGoal">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Listening practices per day</mat-label>
                <input matInput type="number" min="1" max="12" formControlName="dailyListeningGoal">
                <mat-hint>Finish the goal, then keep going with Legendary practice.</mat-hint>
              </mat-form-field>
              <label>
                Pronunciation speed: {{ form.controls.voiceRate.value }}×
                <mat-slider min="0.5" max="1.2" step="0.05">
                  <input matSliderThumb formControlName="voiceRate">
                </mat-slider>
              </label>
              <mat-form-field appearance="outline">
                <mat-label>Theme</mat-label>
                <mat-select formControlName="theme">
                  <mat-option value="system">Follow device</mat-option>
                  <mat-option value="light">Light</mat-option>
                  <mat-option value="dark">Dark</mat-option>
                </mat-select>
              </mat-form-field>
            </form>
          </mat-card-content>
          <mat-card-actions>
            <button mat-flat-button (click)="save()" [disabled]="form.invalid">Save settings</button>
          </mat-card-actions>
        </mat-card>

        <app-pwa-install-card />

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Data & backup</mat-card-title></mat-card-header>
          <mat-card-content>
            <p>All words, practice history, and reports are saved to your account.</p>
            <input #backupInput hidden type="file" accept=".json,application/json" (change)="restore($event)">
            <div class="actions">
              <button mat-stroked-button (click)="exportBackup()">Download full backup</button>
              <button mat-stroked-button (click)="backupInput.click()">Restore backup</button>
              <button mat-flat-button class="danger" (click)="reset()">Delete all progress</button>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>House spacing rules</mat-card-title></mat-card-header>
          <mat-card-content>
            <p>House 1: daily</p>
            <p>House 2 → 3: 2 days</p>
            <p>House 3 → 4: 3 days</p>
            <p>House 4 → 5: 7 days</p>
            <p>House 5 review: 14 days</p>
            <small>A card can only be promoted on its due day. Free practice never changes its house.</small>
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    :host{display:block}.page{display:grid;gap:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.grid>mat-card{padding:18px}.form{display:grid}.form>label{display:grid;gap:8px;margin-bottom:16px}.actions{display:flex;flex-wrap:wrap;gap:8px}.danger{background:var(--mat-sys-error)!important;color:var(--mat-sys-on-error)!important}@media(max-width:800px){.grid{grid-template-columns:1fr}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent implements OnInit {
  readonly store = inject(LearningStoreService);
  private readonly learningSettings = inject(LearningSettingsService);
  private readonly theme = inject(ThemeService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly form = new FormGroup({
    dailyNew: new FormControl(10, { nonNullable: true, validators: [Validators.min(1), Validators.max(50)] }),
    dailyGoal: new FormControl(20, { nonNullable: true, validators: [Validators.min(5), Validators.max(200)] }),
    dailyListeningGoal: new FormControl(3, { nonNullable: true, validators: [Validators.min(1), Validators.max(12)] }),
    voiceRate: new FormControl(.85, { nonNullable: true, validators: [Validators.min(.5), Validators.max(1.2)] }),
    theme: new FormControl<ThemeMode>('system', { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    const state = await this.store.initialize();
    this.applySettings(state.settings);
  }

  async save(): Promise<void> {
    const state = await this.learningSettings.save(this.form.getRawValue());
    this.theme.apply(state.settings.theme);
    this.snack.open('Settings saved.', 'OK', { duration: 2000 });
  }

  exportBackup(): void {
    const state = this.store.snapshot();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocora-backup-${localDay()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async restore(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = hydrateState(JSON.parse(await file.text()) as LearningState);
      const ok = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Restore backup',
          message: `This backup contains ${parsed.words.length} words. Replace your current data?`,
          confirmLabel: 'Restore',
        },
      }).afterClosed());
      if (ok) {
        const daily = ensureDailyWords(parsed);
        await this.store.replaceAndPersist(daily.state);
        this.applySettings(daily.state.settings);
        this.theme.apply(daily.state.settings.theme);
        this.snack.open('Backup restored.', 'OK', { duration: 2500 });
      }
    } catch (error) {
      this.snack.open(error instanceof Error ? error.message : 'The backup file is invalid.', 'Close');
    } finally {
      input.value = '';
    }
  }

  async reset(): Promise<void> {
    const ok = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete progress',
        message: 'Delete all progress, mistakes, and review history?',
        confirmLabel: 'Delete',
        danger: true,
      },
    }).afterClosed());
    if (!ok) return;
    await this.store.update((state) => {
      state.words = state.words.map((word, index) => createWord({
        number: word.number || index + 1,
        term: word.term,
        accepted: word.accepted,
        category: word.category,
        tags: word.tags,
        lessons: word.lessons,
        notes: word.notes,
      }, index));
      state.history = [];
      state.daily = {};
    });
    this.snack.open('Progress deleted.', 'OK', { duration: 2000 });
  }

  private applySettings(settings: LearningState['settings']): void {
    this.form.setValue({
      dailyNew: settings.dailyNew,
      dailyGoal: settings.dailyGoal,
      dailyListeningGoal: settings.dailyListeningGoal ?? 3,
      voiceRate: settings.voiceRate,
      theme: settings.theme,
    });
  }
}
