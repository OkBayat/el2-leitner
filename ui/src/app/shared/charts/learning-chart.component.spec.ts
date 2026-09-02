import {describe, expect, it} from 'vitest';
import {buildLearningChartConfig, doughnutPercent, type LearningChartPoint} from './learning-chart.component';

const points: LearningChartPoint[] = [
	{key: 'a', label: 'Aug 20', value: 10},
	{key: 'b', label: 'Aug 21', value: 20},
	{key: 'c', label: 'Aug 22', value: 30},
];

describe('Chart.js learning chart adapter', () => {
	it('builds the dashboard activity as a real blue bar chart', () => {
		const config = buildLearningChartConfig(points, 'bar');
		expect(config.type).toBe('bar');
		expect(config.data.labels).toEqual(['Aug 20', 'Aug 21', 'Aug 22']);
		expect(config.data.datasets[0].data).toEqual([10, 20, 30]);
		expect(config.data.datasets[0].backgroundColor).toBe('rgb(26 115 232)');
	});

	it('pins accuracy lines to 0-100, preserves missing values as gaps, and uses the blue chart accent', () => {
		const config = buildLearningChartConfig([
			{key: '1', label: '8/1', value: 68},
			{key: '2', label: '8/2', value: null},
			{key: '3', label: '8/3', value: 83},
		], 'line', 0, 100, '%');
		expect(config.type).toBe('line');
		expect(config.data.datasets[0].data).toEqual([68, null, 83]);
		expect(config.data.datasets[0].borderColor).toBe('rgb(26 115 232)');
		expect(config.options?.scales?.['y']?.min).toBe(0);
		expect(config.options?.scales?.['y']?.max).toBe(100);
	});

	it('builds a clearly split blue and gray doughnut chart for part-to-whole coverage', () => {
		const coverage: LearningChartPoint[] = [
			{key: 'entered', label: 'In Leitner', value: 1337},
			{key: 'remaining', label: 'Not yet added', value: 1554},
		];
		const config = buildLearningChartConfig(coverage, 'doughnut');
		expect(config.type).toBe('doughnut');
		expect(config.data.datasets[0].data).toEqual([1337, 1554]);
		expect(config.data.datasets[0].backgroundColor).toEqual(['rgb(26 115 232)', 'rgb(218 220 224)']);
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
});
