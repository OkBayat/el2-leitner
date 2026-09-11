import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VocoButtonComponent } from '../../shared/voco-button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-client.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, VocoButtonComponent, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <main class="auth-page">
      <mat-card class="auth-card" appearance="outlined">
        <div class="auth-brand">
          <img src="/assets/vocora-logo.svg" alt="" width="48" height="38">
          <span>Vocora</span>
        </div>
        <mat-card-header><mat-card-title>Welcome back 👋</mat-card-title><mat-card-subtitle>Sign in to continue your practice.</mat-card-subtitle></mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
            <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput type="email" formControlName="email" autocomplete="email"></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Password</mat-label><input matInput type="password" formControlName="password" autocomplete="current-password"></mat-form-field>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <voco-primary-button
							type="submit"
							[disabled]="loading()"
						>@if(loading()){<mat-spinner diameter="20"/>} @else { Sign in to Vocora }</voco-primary-button>
          </form>
        </mat-card-content>
        <mat-card-actions>Don't have an account yet? <voco-secondary-link routerLink="/register"
						>Create one</voco-secondary-link></mat-card-actions>
      </mat-card>
      <section class="auth-visual"><p>Smart, consistent practice</p><h1>A few words every day, one step closer to IELTS</h1><span>Your progress, mistakes, and review plan stay saved to your account.</span></section>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100dvh}.auth-page{min-height:100dvh;display:grid;grid-template-columns:minmax(320px,480px) 1fr}.auth-card{margin:auto 40px;width:min(100% - 40px,420px);padding:28px;border-radius:28px}.auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}.auth-brand img{display:block;width:48px;height:auto}.auth-brand span{color:var(--vocora-brand-green-strong);font-size:28px;font-weight:800;letter-spacing:-.5px}.auth-form{display:grid;gap:8px;margin-top:24px}.auth-form>button{min-height:48px}.error{padding:12px;border-radius:12px;background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}.auth-visual{display:grid;place-content:center;padding:8vw;background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}.auth-visual h1{max-width:650px;font-size:clamp(34px,5vw,64px);line-height:1.25}@media(max-width:760px){.auth-page{grid-template-columns:1fr}.auth-visual{display:none}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent implements OnInit {
  private readonly auth = inject(AuthService); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  readonly loading = signal(false); readonly error = signal('');
  readonly form = new FormGroup({ email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }), password: new FormControl('', { nonNullable: true, validators: [Validators.required] }) });
  async ngOnInit(): Promise<void> { if (await this.auth.currentUser()) await this.goNext(); }
  async submit(): Promise<void> { this.error.set(''); if (this.form.invalid) { this.error.set('Enter a valid email and password.'); return; } this.loading.set(true); try { await this.auth.login(this.form.controls.email.value, this.form.controls.password.value); await this.goNext(); } catch (error) { this.error.set(error instanceof ApiError ? error.message : 'Sign in failed.'); } finally { this.loading.set(false); } }
  private async goNext(): Promise<void> { await this.router.navigateByUrl(this.auth.safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo'))); }
}
