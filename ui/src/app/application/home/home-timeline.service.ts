import { Injectable, inject, signal } from '@angular/core';
import { ApiClientService } from '../../core/http/api-client.service';
import { TimelineDay, TimelinePage } from '../../domain/home/daily-path';

@Injectable()
export class HomeTimelineService {
  private readonly api = inject(ApiClientService);
  readonly days = signal<TimelineDay[]>([]);
  readonly today = signal('');
  readonly nextBefore = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingOlder = signal(false);
  readonly error = signal('');
  readonly historyError = signal('');
  readonly limitedHistory = signal(false);

  async refresh(): Promise<boolean> {
    if (this.loading() || this.loadingOlder()) return false;
    this.loading.set(true); this.error.set('');
    try {
      const page = await this.fetchPage();
      const newDay = this.today() !== page.today;
      const previousOldest = this.days()[0]?.day;
      // A new day starts a fresh window; earlier dates remain available through the cursor.
      if (newDay) { this.days.set([]); this.historyError.set(''); this.limitedHistory.set(false); }
      this.merge(page);
      this.today.set(page.today);
      // Preserve an already expanded window, but discover history imported by another device.
      if (newDay || !previousOldest || (page.days[0] && page.days[0].day <= previousOldest)) {
        this.nextBefore.set(page.nextBefore);
      }
      return true;
    } catch {
      this.error.set(this.days().length ? 'Could not refresh your history. Showing the last loaded record.' : 'Your practice history could not load.');
      return false;
    } finally { this.loading.set(false); }
  }

  async loadOlder(): Promise<boolean> {
    const before = this.nextBefore();
    if (!before || this.loading() || this.loadingOlder()) return false;
    this.loadingOlder.set(true); this.historyError.set('');
    try {
      const page = await this.fetchPage(before);
      this.merge(page); this.nextBefore.set(page.nextBefore);
      return true;
    } catch {
      this.historyError.set('Earlier days could not load. Please try again.');
      return false;
    } finally { this.loadingOlder.set(false); }
  }

  private fetchPage(before?: string): Promise<TimelinePage> {
    const params = new URLSearchParams({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', limit: '7' });
    if (before) params.set('before', before);
    return this.api.get<TimelinePage>(`/api/learning/timeline?${params}`);
  }

  private merge(page: TimelinePage): void {
    const records = new Map(this.days().map(day => [day.day, day]));
    for (const day of page.days) records.set(day.day, day);
    this.days.set([...records.values()].sort((a, b) => a.day.localeCompare(b.day)));
    this.limitedHistory.update(value => value || page.limitedHistory);
  }
}
