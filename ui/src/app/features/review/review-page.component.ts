import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReviewSessionService } from '../../application/review/review-session.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { getDueWords, localDay } from '../../domain/learning/learning-rules';
import { ReviewMode } from '../../domain/learning/models';
import { RemediationPhase } from '../../domain/remediation/remediation';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({selector:'app-review-page',imports:[ReactiveFormsModule,MatButtonModule,MatCardModule,MatFormFieldModule,MatInputModule,MatProgressBarModule,MatSelectModule,MatSnackBarModule],template:`
<section class="review-page"><header><h1>مرور امروز</h1><p>مرور موعددار، تمرین آزاد و بازآزمایی املا در یک جریان واحد.</p></header>
@if(!session.active()&&!session.completed()){
  <mat-card class="setup" appearance="outlined"><mat-card-header><mat-card-title>جلسهٔ امروز</mat-card-title></mat-card-header><mat-card-content><div class="breakdown"><div><strong>{{dueCount()}}</strong><span>کارت آماده</span></div><div><strong>{{newCount()}}</strong><span>لغت جدید</span></div><div><strong>{{estimatedMinutes()}}</strong><span>دقیقه تقریبی</span></div></div><mat-form-field appearance="outline"><mat-label>حداکثر کارت</mat-label><mat-select [formControl]="limit"><mat-option [value]="0">همه</mat-option><mat-option [value]="10">۱۰ کارت</mat-option><mat-option [value]="20">۲۰ کارت</mat-option><mat-option [value]="30">۳۰ کارت</mat-option></mat-select></mat-form-field></mat-card-content><mat-card-actions><button mat-flat-button (click)="start('review')">شروع جلسه</button><button mat-stroked-button (click)="start('box1')">تمرین آزاد خانهٔ ۱</button></mat-card-actions></mat-card>
}
@if(session.active()&&session.currentWord();as word){
  <div class="session-bar"><button mat-button (click)="exit()">خروج</button><div><span>{{session.currentTask()==='recheck'?'بازآزمایی املا':session.answered()+1+' از '+session.initialCount()}}</span><mat-progress-bar mode="determinate" [value]="session.progress()"/></div><span>دقت: {{session.accuracy()??'—'}}٪</span></div>
  <mat-card class="flash" appearance="outlined"><mat-card-header><mat-card-subtitle>{{word.category}} · خانهٔ {{word.box}}</mat-card-subtitle><mat-card-title>{{session.currentTask()==='recheck'?'بازآزمایی املا':'کلمه را بشنو و املای آن را بنویس'}}</mat-card-title></mat-card-header><mat-card-content>
    <div class="listen"><button mat-fab extended (click)="session.pronounce()">▶ پخش تلفظ</button><button mat-button (click)="session.pronounce(.7)">آهسته‌تر</button></div>
    @if(session.currentTask()==='review'&&!session.feedback()){
      <form (ngSubmit)="submit()" class="answer-form"><mat-form-field appearance="outline"><mat-label>پاسخ شما</mat-label><input matInput [formControl]="answer" lang="en" dir="ltr" autocomplete="off"></mat-form-field><button mat-flat-button type="submit" [disabled]="saving()">بررسی پاسخ</button><button mat-button type="button" (click)="dontKnow()">نمی‌دانم</button></form>
    }
    @if(session.feedback();as feedback){<div class="feedback" [class.wrong]="!feedback.correct"><h2>{{feedback.title}}</h2><p>{{feedback.detail}}</p><strong dir="ltr">{{feedback.spelling}}</strong></div>}
    @if(session.remediation();as remediation){<section class="remediation"><h3>{{remediation.phase===Phase.CORRECTION?'اصلاح املا':remediation.phase===Phase.COPY?'یک‌بار دقیق بنویس':'بدون نگاه کردن دوباره بنویس'}}</h3>@if(remediation.answerVisible){<p class="target" dir="ltr">{{remediation.target}}</p><p>{{hint(remediation)}}</p>}@if(remediation.phase===Phase.CORRECTION){<button mat-flat-button (click)="acknowledge()">دیدم؛ از حفظ می‌نویسم</button>}@else if(remediation.phase!==Phase.COMPLETED){<mat-form-field appearance="outline"><mat-label>{{remediation.phase===Phase.COPY?'کپی دقیق':'یادآوری از حفظ'}}</mat-label><input matInput [formControl]="remediationAnswer" dir="ltr" (keydown.enter)="submitRemediation();$event.preventDefault()"></mat-form-field><button mat-flat-button (click)="submitRemediation()">بررسی</button>}@else{<p>این مرحله کامل شد و بازآزمایی در زمان مناسب داخل همین جلسه انجام می‌شود.</p>}</section>}
  </mat-card-content><mat-card-actions>@if(session.canAdvance()){<button mat-flat-button (click)="next()">کارت بعدی</button>}</mat-card-actions></mat-card>
}
@if(session.completed()){
  <mat-card class="complete" appearance="outlined"><mat-card-title>جلسه کامل شد ★</mat-card-title><mat-card-content><div class="breakdown"><div><strong>{{session.correct()}}</strong><span>درست</span></div><div><strong>{{session.wrong()}}</strong><span>اشتباه</span></div><div><strong>{{session.accuracy()??0}}٪</strong><span>دقت</span></div></div></mat-card-content><mat-card-actions><button mat-flat-button (click)="router.navigateByUrl('/dashboard')">بازگشت به خانه</button><button mat-stroked-button (click)="start('box1')">ادامه تمرین آزاد</button></mat-card-actions></mat-card>
}
</section>`,styles:[`:host{display:block}.review-page{max-width:850px;margin:auto;display:grid;gap:18px}.setup,.flash,.complete{padding:24px;border-radius:28px}.breakdown{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.breakdown div{display:grid;padding:16px;background:var(--mat-sys-surface-container);border-radius:16px}.breakdown strong{font-size:26px}.session-bar{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center}.session-bar>div{display:grid;gap:7px}.listen{display:flex;justify-content:center;gap:10px;margin:24px}.answer-form{display:grid;gap:10px}.feedback,.remediation{margin-top:16px;padding:18px;border-radius:18px;background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}.feedback.wrong{background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}.remediation{background:var(--mat-sys-tertiary-container);color:var(--mat-sys-on-tertiary-container)}.remediation mat-form-field{width:100%}.target{font-size:32px;font-weight:800;text-align:center}@media(max-width:600px){.breakdown{grid-template-columns:1fr}.session-bar{grid-template-columns:1fr}}`],changeDetection:ChangeDetectionStrategy.OnPush})
export class ReviewPageComponent implements OnInit{readonly session=inject(ReviewSessionService);readonly store=inject(LearningStoreService);readonly router=inject(Router);private readonly route=inject(ActivatedRoute);private readonly snack=inject(MatSnackBar);private readonly dialog=inject(MatDialog);readonly Phase=RemediationPhase;readonly answer=new FormControl('',{nonNullable:true});readonly remediationAnswer=new FormControl('',{nonNullable:true});readonly limit=new FormControl(0,{nonNullable:true});readonly saving=signal(false);readonly state=this.store.state;readonly dueCount=computed(()=>this.state()?getDueWords(this.state()!).length:0);readonly newCount=computed(()=>this.state()?getDueWords(this.state()!).filter(w=>w.introducedOn===localDay()&&w.box===1).length:0);readonly estimatedMinutes=computed(()=>Math.max(1,Math.ceil(this.dueCount()*.35)));
  async ngOnInit(){await this.store.initialize();const mode=this.route.snapshot.queryParamMap.get('mode') as ReviewMode|null;if(mode==='new'||mode==='box1')await this.start(mode);}
  async start(mode:ReviewMode){const ok=await this.session.start(mode,this.limit.value);if(!ok)this.snack.open(mode==='box1'?'هنوز کارتی در خانهٔ ۱ وجود ندارد.':'مرور موعدداری وجود ندارد.','باشه',{duration:3000});else setTimeout(()=>this.session.pronounce(),200);}
  async submit(){if(!this.answer.value.trim())return;this.saving.set(true);try{await this.session.submit(this.answer.value);this.answer.setValue('');}catch(error){this.snack.open(error instanceof Error?error.message:'ذخیره پاسخ انجام نشد.','بستن');}finally{this.saving.set(false);}}
  async dontKnow(){this.saving.set(true);try{await this.session.submit('',true);}finally{this.saving.set(false);}}
  acknowledge(){this.session.acknowledgeCorrection();this.remediationAnswer.setValue('');}
  submitRemediation(){if(!this.remediationAnswer.value.trim())return;this.session.submitRemediation(this.remediationAnswer.value);this.remediationAnswer.setValue('');}
  hint(snapshot:{comparison:unknown}){const comparison=snapshot.comparison as import('../../domain/remediation/remediation').SpellingComparison;return import('../../domain/remediation/remediation').then?this.hintText(comparison):'';}private hintText(comparison:import('../../domain/remediation/remediation').SpellingComparison){const trans=comparison.transposition;if(trans)return`ترتیب «${trans.answer}» را به «${trans.target}» جابه‌جا کن.`;const miss=comparison.operations.filter(x=>x.type==='insert').map(x=>x.target).filter(Boolean);return miss.length?`حرف ${miss.join('، ')} جا افتاده است.`:'به تفاوت حروف دقت کن.';}
  async next(){await this.session.next();this.answer.setValue('');this.remediationAnswer.setValue('');setTimeout(()=>this.session.pronounce(),180);}
  async exit(){const ok=await firstValueFrom(this.dialog.open(ConfirmDialogComponent,{data:{title:'خروج از جلسه',message:'پاسخ‌های ثبت‌شده حفظ می‌شوند. جلسه متوقف شود؟',confirmLabel:'خروج'}}).afterClosed());if(ok){await this.session.abandon();await this.router.navigateByUrl('/dashboard');}}
}
