import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-client.service';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <main class="auth-page"><mat-card class="auth-card" appearance="outlined"><img src="/assets/vocora-logo.png" alt="Vocora" width="185" height="46"><mat-card-header><mat-card-title>ساخت حساب</mat-card-title><mat-card-subtitle>فقط با ایمیل و رمز عبور تمرینت را شروع کن.</mat-card-subtitle></mat-card-header><mat-card-content><form [formGroup]="form" (ngSubmit)="submit()" class="auth-form"><mat-form-field appearance="outline"><mat-label>ایمیل</mat-label><input matInput type="email" formControlName="email" autocomplete="email" dir="ltr"></mat-form-field><mat-form-field appearance="outline"><mat-label>رمز عبور</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password" dir="ltr"><mat-hint>حداقل ۸ کاراکتر</mat-hint></mat-form-field>@if(error()){<p class="error" role="alert">{{error()}}</p>}<button mat-flat-button type="submit" [disabled]="loading()">@if(loading()){<mat-spinner diameter="20"/>}@else{ساخت حساب}</button></form></mat-card-content><mat-card-actions>قبلاً حساب ساخته‌ای؟ <a mat-button routerLink="/login">وارد شو</a></mat-card-actions></mat-card><section class="auth-visual"><p>شروع ساده، رشد قابل‌اندازه‌گیری</p><h1>جعبهٔ لایتنر شخصی تو همیشه همراهت است</h1><span>داده‌ها در حساب تو ذخیره می‌شوند؛ بدون وابستگی به یک مرورگر یا دستگاه.</span></section></main>
  `,
  styles: [`:host{display:block;min-height:100dvh}.auth-page{min-height:100dvh;display:grid;grid-template-columns:minmax(320px,480px) 1fr}.auth-card{margin:auto 40px;width:min(100% - 40px,420px);padding:28px;border-radius:28px}.auth-card>img{margin-bottom:28px}.auth-form{display:grid;gap:8px;margin-top:24px}.auth-form>button{min-height:48px}.error{padding:12px;border-radius:12px;background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}.auth-visual{display:grid;place-content:center;padding:8vw;background:var(--mat-sys-tertiary-container);color:var(--mat-sys-on-tertiary-container)}.auth-visual h1{max-width:650px;font-size:clamp(34px,5vw,64px);line-height:1.25}@media(max-width:760px){.auth-page{grid-template-columns:1fr}.auth-visual{display:none}}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private readonly auth=inject(AuthService); private readonly route=inject(ActivatedRoute); private readonly router=inject(Router); readonly loading=signal(false); readonly error=signal('');
  readonly form=new FormGroup({email:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.email]}),password:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.minLength(8)]})});
  async submit():Promise<void>{this.error.set('');if(this.form.invalid){this.error.set('رمز عبور باید حداقل ۸ کاراکتر و ایمیل معتبر باشد.');return;}this.loading.set(true);try{await this.auth.register(this.form.controls.email.value,this.form.controls.password.value);await this.router.navigateByUrl(this.auth.safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo')));}catch(error){this.error.set(error instanceof ApiError?error.message:'ثبت‌نام انجام نشد.');}finally{this.loading.set(false);}}
}
