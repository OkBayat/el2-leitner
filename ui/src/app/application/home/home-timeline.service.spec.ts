import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientService } from '../../core/http/api-client.service';
import { TimelinePage } from '../../domain/home/daily-path';
import { HomeTimelineService } from './home-timeline.service';

function page(day = '2026-09-06', activities: TimelinePage['days'][number]['activities'] = []): TimelinePage {
  return { today: '2026-09-06', days: [{ day, activities, boxOnePracticed: false }], nextBefore: day, limitedHistory: false };
}

describe('HomeTimelineService', () => {
  let service: HomeTimelineService;
  const get = vi.fn();
  beforeEach(() => {
    get.mockReset();
    TestBed.configureTestingModule({ providers: [HomeTimelineService, { provide: ApiClientService, useValue: { get } }] });
    service = TestBed.inject(HomeTimelineService);
  });

  it('fetches real practice evidence with the browser timezone and never writes completion', async () => {
    get.mockResolvedValue(page('2026-09-06', ['listening']));
    expect(await service.refresh()).toBe(true);
    const query = new URL(get.mock.calls[0][0], 'https://vocora.test');
    expect(query.pathname).toBe('/api/learning/timeline');
    expect(query.searchParams.get('timeZone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(service.days()[0].activities).toEqual(['listening']);
  });

  it('prepends history without duplicates and refreshes the same day without losing older pages', async () => {
    get.mockResolvedValueOnce(page()).mockResolvedValueOnce({ ...page('2026-09-05', ['vocabulary']), nextBefore: null });
    await service.refresh(); await service.loadOlder();
    expect(new URL(get.mock.calls[1][0], 'https://vocora.test').searchParams.get('before')).toBe('2026-09-06');
    get.mockResolvedValueOnce(page('2026-09-06', ['shadowing']));
    await service.refresh();
    expect(service.days().map(day => day.day)).toEqual(['2026-09-05', '2026-09-06']);
    expect(service.days()[1].activities).toEqual(['shadowing']);
    expect(service.nextBefore()).toBeNull();
  });

  it('keeps loaded evidence and the pagination cursor when an API request fails', async () => {
    get.mockResolvedValueOnce(page('2026-09-06', ['vocabulary']));
    await service.refresh();
    get.mockRejectedValue(new Error('offline'));
    expect(await service.refresh()).toBe(false);
    expect(await service.loadOlder()).toBe(false);
    expect(service.days()[0].activities).toEqual(['vocabulary']);
    expect(service.nextBefore()).toBe('2026-09-06');
    expect(service.error()).not.toBe(''); expect(service.historyError()).not.toBe('');
    expect(service.loading()).toBe(false); expect(service.loadingOlder()).toBe(false);
  });

  it('serializes requests while history is loading', async () => {
    let resolve!: (value: TimelinePage) => void;
    get.mockImplementation(() => new Promise<TimelinePage>(done => { resolve = done; }));
    const first = service.refresh();
    expect(await service.refresh()).toBe(false);
    expect(await service.loadOlder()).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
    resolve(page()); await first;
  });

  it('starts a new window after midnight instead of leaving unknown gaps gray', async () => {
    get.mockResolvedValueOnce(page()); await service.refresh();
    get.mockResolvedValueOnce({ ...page('2026-09-20'), today: '2026-09-20' });
    await service.refresh();
    expect(service.today()).toBe('2026-09-20');
    expect(service.days().map(day => day.day)).toEqual(['2026-09-20']);
    expect(service.nextBefore()).toBe('2026-09-20');
  });

  it('does not replace the current day using an older-page response crossing midnight', async () => {
    get.mockResolvedValueOnce(page()); await service.refresh();
    get.mockResolvedValueOnce({ ...page('2026-09-05'), today: '2026-09-07' });
    await service.loadOlder();
    expect(service.today()).toBe('2026-09-06');
  });
});
