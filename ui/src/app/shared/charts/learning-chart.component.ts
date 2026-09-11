import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, input, signal} from '@angular/core';
import {
	ArcElement,
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	type ChartConfiguration,
	DoughnutController,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
	type TooltipItem,
} from 'chart.js';
import {ThemeService} from '../../core/theme/theme.service';

export type LearningChartType = 'bar' | 'line' | 'doughnut';
type LearningChartConfiguration = ChartConfiguration<any, any[], unknown>;

export interface LearningChartPoint {
	key: string;
	label: string;
	value: number | null;
}

export interface LearningChartPalette {
	primary: string;
	track: string;
	text: string;
	grid: string;
}

Chart.register(
	ArcElement,
	BarController,
	BarElement,
	CategoryScale,
	DoughnutController,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
);

const FALLBACK_PALETTE: LearningChartPalette = {
	primary: 'currentColor',
	track: 'transparent',
	text: 'currentColor',
	grid: 'transparent',
};

function finiteOrNull(value: number | null): number | null {
	return value !== null && Number.isFinite(value) ? value : null;
}

export function buildLearningChartConfig(
	points: LearningChartPoint[],
	type: LearningChartType,
	requestedMin: number | null = null,
	requestedMax: number | null = null,
	suffix = '',
	palette: LearningChartPalette = FALLBACK_PALETTE,
): LearningChartConfiguration {
	const labels = points.map((point) => point.label);
	const values = points.map((point) => finiteOrNull(point.value));

	if (type === 'doughnut') {
		return {
			type: 'doughnut',
			data: {
				labels,
				datasets: [{
					data: values.map((value) => value ?? 0),
					backgroundColor: points.map((_, index) => index === 0 ? palette.primary : palette.track),
					borderWidth: 0,
					hoverBackgroundColor: points.map((_, index) => index === 0 ? palette.primary : palette.track),
					hoverBorderWidth: 0,
					hoverOffset: 0,
				}],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '82%',
				rotation: 0,
				animation: {duration: 220},
				plugins: {
					legend: {display: false},
					tooltip: {enabled: false},
				},
			},
		};
	}

	const isBar = type === 'bar';
	return {
		type,
		data: {
			labels,
			datasets: [{
				data: values,
				backgroundColor: isBar ? palette.primary : 'transparent',
				hoverBackgroundColor: isBar ? palette.primary : 'transparent',
				borderColor: palette.primary,
				borderWidth: isBar ? 0 : 3,
				borderRadius: isBar ? 7 : 0,
				maxBarThickness: isBar ? 34 : undefined,
				pointBackgroundColor: palette.primary,
				pointBorderColor: palette.primary,
				pointRadius: isBar ? 0 : 3,
				pointHoverRadius: isBar ? 0 : 5,
				tension: isBar ? 0 : .3,
				spanGaps: false,
			}],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: {duration: 220},
			plugins: {
				legend: {display: false},
				tooltip: {
					displayColors: false,
					callbacks: {
						label: (context: TooltipItem<any>) => `${context.parsed.y === null ? '—' : Math.round(context.parsed.y)}${suffix}`,
					},
				},
			},
			scales: {
				x: {
					grid: {display: false},
					border: {display: false},
					ticks: {
						autoSkip: true,
						color: palette.text,
						maxRotation: 0,
						maxTicksLimit: isBar ? 14 : 9,
					},
				},
				y: {
					beginAtZero: requestedMin === null || requestedMin <= 0,
					min: requestedMin ?? undefined,
					max: requestedMax ?? undefined,
					grid: {color: palette.grid},
					border: {display: false},
					ticks: {
						color: palette.text,
						callback: (value: string | number) => `${Math.round(Number(value))}${suffix}`,
					},
				},
			},
		},
	};
}

export function doughnutPercent(points: LearningChartPoint[]): number {
	const values = points.map((point) => Math.max(0, finiteOrNull(point.value) ?? 0));
	const total = values.reduce((sum, value) => sum + value, 0);
	return total ? Math.round(values[0] / total * 100) : 0;
}

@Component({
	selector: 'app-learning-chart',
	template: `
		<div
			class="chart-frame"
			[class.is-doughnut]="type() === 'doughnut'"
			[attr.aria-label]="ariaLabel()"
			role="img"
		>
			<canvas #canvas aria-hidden="true"></canvas>
			@if (type() === 'doughnut') {
				<div class="doughnut-center" aria-hidden="true">
					<strong>{{ percentage() }}%</strong>
					<span>{{ centerLabel() }}</span>
				</div>
			}
		</div>
	`,
	styles: [`
		:host{display:block;min-width:0;--vocora-chart-primary:var(--vocora-primary);--vocora-chart-track:var(--vocora-border-subtle);--vocora-chart-text:var(--vocora-text-secondary);--vocora-chart-grid:var(--vocora-border-subtle)}.chart-frame{position:relative;width:100%;height:270px}.chart-frame canvas{display:block;width:100%!important;height:100%!important}.chart-frame.is-doughnut{width:86px;height:86px;min-width:86px}.doughnut-center{position:absolute;inset:0;display:grid;place-content:center;text-align:center;pointer-events:none}.doughnut-center strong{color:var(--mat-sys-on-surface);font-size:20px;font-weight:500;letter-spacing:-.03em;line-height:1}.doughnut-center span{margin-top:4px;color:var(--mat-sys-on-surface-variant);font-size:9px;font-weight:600}@media(max-width:700px){.chart-frame:not(.is-doughnut){height:245px}}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningChartComponent implements AfterViewInit, OnDestroy {
	@ViewChild('canvas', {static: true}) private canvas!: ElementRef<HTMLCanvasElement>;
	private readonly host = inject(ElementRef<HTMLElement>);
	private readonly theme = inject(ThemeService);
	private readonly ready = signal(false);
	private chart: Chart | null = null;

	readonly type = input.required<LearningChartType>();
	readonly points = input.required<LearningChartPoint[]>();
	readonly min = input<number | null>(null);
	readonly max = input<number | null>(null);
	readonly suffix = input('');
	readonly ariaLabel = input('Learning chart');
	readonly centerLabel = input('in Leitner');
	readonly percentage = computed(() => doughnutPercent(this.points()));

	constructor() {
		effect(() => {
			this.theme.resolvedTheme();
			if (!this.ready()) return;
			this.render(
				this.type(),
				this.points(),
				this.min(),
				this.max(),
				this.suffix(),
			);
		});
	}

	ngAfterViewInit(): void {
		this.ready.set(true);
	}

	ngOnDestroy(): void {
		this.chart?.destroy();
	}

	private render(
		type: LearningChartType,
		points: LearningChartPoint[],
		min: number | null,
		max: number | null,
		suffix: string,
	): void {
		this.chart?.destroy();
		this.chart = new Chart(this.canvas.nativeElement, buildLearningChartConfig(points, type, min, max, suffix, this.palette()));
	}

	private palette(): LearningChartPalette {
		const styles = getComputedStyle(this.host.nativeElement);
		const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
		return {
			primary: token('--vocora-chart-primary', FALLBACK_PALETTE.primary),
			track: token('--vocora-chart-track', FALLBACK_PALETTE.track),
			text: token('--vocora-chart-text', FALLBACK_PALETTE.text),
			grid: token('--vocora-chart-grid', FALLBACK_PALETTE.grid),
		};
	}
}
