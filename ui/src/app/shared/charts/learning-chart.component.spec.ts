import {describe, expect, it} from 'vitest';
import {buildLearningChartGeometry, type LearningChartPoint} from './learning-chart.component';

const points: LearningChartPoint[] = [
	{key: 'a', label: 'Aug 20', value: 10},
	{key: 'b', label: 'Aug 21', value: 20},
	{key: 'c', label: 'Aug 22', value: 30},
];

describe('buildLearningChartGeometry', () => {
	it('scales bars against the real maximum instead of collapsing them to the baseline', () => {
		const chart = buildLearningChartGeometry(points, 'bar');
		expect(chart.points[0].barHeight).toBeGreaterThan(50);
		expect(chart.points[2].barHeight).toBeGreaterThan(chart.points[1].barHeight);
		expect(chart.points[1].barHeight).toBeGreaterThan(chart.points[0].barHeight);
		expect(chart.points[2].barY).toBe(chart.plotTop);
	});

	it('pins accuracy charts to a 0-100 scale and builds a connected line', () => {
		const chart = buildLearningChartGeometry([
			{key: '1', label: '8/1', value: 68},
			{key: '2', label: '8/2', value: 74},
			{key: '3', label: '8/3', value: 83},
		], 'line', 0, 100);
		expect(chart.min).toBe(0);
		expect(chart.max).toBe(100);
		expect(chart.linePath).toMatch(/^M /u);
		expect(chart.linePath.match(/L /gu)?.length).toBe(2);
		expect(chart.points[2].y).toBeLessThan(chart.points[0].y);
	});

	it('breaks a line across missing daily values instead of fabricating data', () => {
		const chart = buildLearningChartGeometry([
			{key: '1', label: '8/1', value: 68},
			{key: '2', label: '8/2', value: null},
			{key: '3', label: '8/3', value: 83},
		], 'line', 0, 100);
		expect(chart.linePath.match(/M /gu)?.length).toBe(2);
		expect(chart.areaPath).toBe('');
	});

	it('reduces x-axis labels on long line charts while keeping the final date visible', () => {
		const longSeries = Array.from({length: 30}, (_, index) => ({
			key: String(index),
			label: `8/${index + 1}`,
			value: 70,
		}));
		const chart = buildLearningChartGeometry(longSeries, 'line', 0, 100);
		expect(chart.points.filter((point) => point.showLabel).length).toBeLessThan(15);
		expect(chart.points.at(-1)?.showLabel).toBe(true);
	});
});
