import {ChangeDetectionStrategy, Component, OnInit, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatSnackBar} from '@angular/material/snack-bar';
import {LibraryApiService} from '../../core/library/library-api.service';
import {LibraryCollection} from '../../domain/learning/models';
import {normalizeAnswer} from '../../domain/learning/learning-rules';
import {CollectionEditorComponent, CollectionPayload, libraryKindLabel, libraryLevel, libraryProgress} from './library-dialogs.component';
import {libraryCoverAssetPath} from './library-cover';

@Component({selector:'app-library-page',imports:[CommonModule,ReactiveFormsModule,MatButtonModule,MatCardModule,MatFormFieldModule,MatInputModule,MatProgressBarModule,MatSelectModule],templateUrl:'library-page.component.html',styleUrl:'library-page.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class LibraryPageComponent implements OnInit {
 private readonly api=inject(LibraryApiService); private readonly router=inject(Router); private readonly snack=inject(MatSnackBar); private readonly missingCoverSlugs=signal<ReadonlySet<string>>(new Set());
 readonly collections=signal<LibraryCollection[]>([]); readonly canManage=signal(false); readonly search=new FormControl('',{nonNullable:true}); readonly kind=new FormControl('all',{nonNullable:true}); readonly status=new FormControl('all',{nonNullable:true});
 private readonly searchValue=toSignal(this.search.valueChanges,{initialValue:this.search.value}); private readonly kindValue=toSignal(this.kind.valueChanges,{initialValue:this.kind.value}); private readonly statusValue=toSignal(this.status.valueChanges,{initialValue:this.status.value});
 readonly filtered=computed(()=>{const q=normalizeAnswer(this.searchValue());const k=this.kindValue();const s=this.statusValue();return this.collections().filter(c=>(!q||normalizeAnswer(`${c.title} ${c.description||''} ${c.kind} ${libraryLevel(c)}`).includes(q))&&(k==='all'||c.kind===k)&&(s==='all'||(s==='subscribed'?c.subscribed:!c.subscribed)));});
 readonly totalWords=computed(()=>this.collections().reduce((s,c)=>s+c.wordCount,0)); readonly subscribedWords=computed(()=>this.collections().filter(c=>c.subscribed).reduce((s,c)=>s+c.wordCount,0)); readonly level=libraryLevel; readonly progress=libraryProgress; readonly kindLabel=libraryKindLabel;
 async ngOnInit(){await this.load();}
 async load(){const r=await this.api.list();this.collections.set(r.collections||[]);this.canManage.set(Boolean(r.capabilities?.canManage));}
 coverUrl(c:LibraryCollection){return libraryCoverAssetPath(c.slug);} coverMissing(s:string){return this.missingCoverSlugs().has(s);} markCoverMissing(s:string){this.missingCoverSlugs.update(c=>new Set([...c,s]));}
 open(c:LibraryCollection){void this.router.navigate(['/library',c.id]);}
 async toggle(c:LibraryCollection){if(c.subscribed)await this.api.unsubscribe(c.id);else await this.api.subscribe(c.id);await this.load();}
 async createCollection(){this.snack.open('Use collection management from details.','OK',{duration:2000});}
}
