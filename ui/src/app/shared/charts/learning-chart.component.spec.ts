import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ThemeService} from '../../core/theme/theme.service';
import {buildLearningChartConfig, doughnutPercent, LearningChartComponent, type LearningChartPoint} from './learning-chart.component';

const points: LearningChartPoint[] = [
	{key: 'a', label: 'Aug 20', value: 10},
	{key: 'b', label: 'Aug 21', value: 20},
	{key: 'c', label: 'Aug 22', value: 30},
];
const palette = {
	primary: 'primary',
	track: 'track',
	text: 'text',
	grid: 'grid',
};

describe('Chart.js learning chart adapter', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('builds the dashboard activity with the configured primary color', () => {
		const config = buildLearningChartConfig(points, 'bar', null, null, '', palette);
		expect(config.type).toBe('bar');
		expect(config.data.labels).toEqual(['Aug 20', 'Aug 21', 'Aug 22']);
		expect(config.data.datasets[0].data).toEqual([10, 20, 30]);
		expect(config.data.datasets[0].backgroundColor).toBe('primary');
	});

	it('pins accuracy lines to 0-100, preserves missing values as gaps, and uses the configured accent', () => {
		const config = buildLearningChartConfig([
			{key: '1', label: '8/1', value: 68},
			{key: '2', label: '8/2', value: null},
			{key: '3', label: '8/3', value: 83},
		], 'line', 0, 100, '%', palette);
		expect(config.type).toBe('line');
		expect(config.data.datasets[0].data).toEqual([68, null, 83]);
		expect(config.data.datasets[0].borderColor).toBe('primary');
		expect(config.options?.scales?.['y']?.min).toBe(0);
		expect(config.options?.scales?.['y']?.max).toBe(100);
	});

	it('builds a clearly split primary and track doughnut chart for part-to-whole coverage', () => {
		const coverage: LearningChartPoint[] = [
			{key: 'entered', label: 'In Leitner', value: 1337},
			{key: 'remaining', label: 'Not yet added', value: 1554},
		];
		const config = buildLearningChartConfig(coverage, 'doughnut', null, null, '', palette);
		expect(config.type).toBe('doughnut');
		expect(config.data.datasets[0].data).toEqual([1337, 1554]);
		expect(config.data.datasets[0].backgroundColor).toEqual(['primary', 'track']);
		expect(config.options?.cutout).toBe('82%');
		expect(config.options?.rotation).toBe(0);
		expect(doughnutPercent(coverage)).toBe(46);
	});

	it('returns zero coverage for an empty vocabulary', () => {
		expect(doughnutPercent([
			{key: 'entered', label: 'In Leitner', value: 0},
			{key: 'remaining', label: 'Not yet added', value: 0},
		])).toBe(0);
	});

	it('repaints an existing canvas when the resolved application theme changes', () => {
		const resolvedTheme = signal<'light' | 'dark'>('light');
		TestBed.configureTestingModule({
			imports: [LearningChartComponent],
			providers: [{provide: ThemeService, useValue: {resolvedTheme}}],
		});
		const fixture = TestBed.createComponent(LearningChartComponent);
		const render = vi.spyOn(
			fixture.componentInstance as unknown as {render: (...args: unknown[]) => void},
			'render',
		).mockImplementation(() => undefined);
		fixture.componentRef.setInput('type', 'bar');
		fixture.componentRef.setInput('points', points);
		fixture.detectChanges();

		expect(render).toHaveBeenCalledTimes(1);
		resolvedTheme.set('dark');
		fixture.detectChanges();
		expect(render).toHaveBeenCalledTimes(2);
	});
});
