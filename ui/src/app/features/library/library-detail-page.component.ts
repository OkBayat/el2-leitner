import {ChangeDetectionStrategy, Component, OnInit, inject, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {LibraryApiService} from '../../core/library/library-api.service';
import {LibraryCollection} from '../../domain/learning/models';
import {libraryKindLabel, libraryLevel, libraryProgress} from './library-dialogs.component';

@Component({
  selector: 'app-library-detail-page',
  imports: [MatButtonModule, MatProgressBarModule],
  template: `
    @if (collection(); as c) {
      <section class="detail-page">
        <button mat-button (click)="back()">← Back to library</button>
        <header>
          <h1>{{ c.title }}</h1>
          <div class="meta">{{ kindLabel(c.kind) }} · {{ level(c) }} · version {{ c.contentVersion }}</div>
        </header>
        <p>{{ c.description || 'A vocabulary collection for your learning journey.' }}</p>
        <div class="progress">
          <span>{{ progress(c).entered }} of {{ progress(c).total }} words are in Leitner</span>
          <mat-progress-bar mode="determinate" [value]="progress(c).percent" />
        </div>
        <div class="actions">
          <button mat-flat-button (click)="toggle()">{{ c.subscribed ? 'Remove from box' : 'Add to box' }}</button>
          @if (canManage()) { <button mat-stroked-button>Edit collection</button><button mat-stroked-button>Import file</button> }
        </div>
        <h2>Words</h2>
        <div class="words">
          @for (entry of c.entries || []; track entry.id) {
            <div>{{ entry.term }}</div>
          } @empty { <div>No words to display.</div> }
        </div>
      </section>
    }
  `,
  styles: [`.detail-page{display:grid;gap:18px}.meta{color:var(--mat-sys-on-surface-variant)}.progress{display:grid;gap:8px}.actions{display:flex;gap:8px;flex-wrap:wrap}.words{display:grid;gap:8px}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryDetailPageComponent implements OnInit {
  private readonly api = inject(LibraryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly collection = signal<LibraryCollection | null>(null);
  readonly canManage = signal(false);
  readonly level = libraryLevel;
  readonly progress = libraryProgress;
  readonly kindLabel = libraryKindLabel;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const result = await this.api.get(id);
    this.collection.set(result.collection);
    this.canManage.set(Boolean(result.capabilities?.canManage));
  }

  async toggle(): Promise<void> {
    const c = this.collection();
    if (!c) return;
    if (c.subscribed) await this.api.unsubscribe(c.id);
    else await this.api.subscribe(c.id);
    const result = await this.api.get(c.id);
    this.collection.set(result.collection);
  }

  back(): void { void this.router.navigate(['/library']); }
}
