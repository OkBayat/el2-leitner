import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

export type LearningChartType = 'bar' | 'line';

export interface LearningChartPoint {
	key: string;
	label: string;
	value: number | null;
}

interface ChartGeometryPoint extends LearningChartPoint {
	x: number;
	y: number;
	barX: number;
	barY: number;
	barWidth: number;
	barHeight: number;
	showLabel: boolean;
}

interface ChartGeometry {
	width: number;
	height: number;
	plotTop: number;
	plotBottom: number;
	plotLeft: number;
	plotRight: number;
	min: number;
	max: number;
	points: ChartGeometryPoint[];
	grid: {value: number; y: number}[];
	linePath: string;
	areaPath: string;
	minWidth: number;
}

const WIDTH = 820;
const HEIGHT = 270;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 218;
const PLOT_LEFT = 46;
const PLOT_RIGHT = 802;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function buildLearningChartGeometry(
	points: LearningChartPoint[],
	type: LearningChartType,
	requestedMin?: number | null,
	requestedMax?: number | null,
): ChartGeometry {
	const finiteValues = points.flatMap((point) => point.value === null || !Number.isFinite(point.value) ? [] : [point.value]);
	const dataMax = finiteValues.length ? Math.max(...finiteValues) : 1;
	const dataMin = finiteValues.length ? Math.min(...finiteValues) : 0;
	const min = requestedMin ?? Math.min(0, dataMin);
	const rawMax = requestedMax ?? dataMax;
	const max = rawMax <= min ? min + 1 : rawMax;
	const plotWidth = PLOT_RIGHT - PLOT_LEFT;
	const plotHeight = PLOT_BOTTOM - PLOT_TOP;
	const count = Math.max(1, points.length);
	const slot = plotWidth / count;
	const barWidth = Math.max(12, Math.min(34, slot * .58));
	const labelEvery = type === 'line' && points.length > 16 ? Math.ceil(points.length / 8) : 1;

	const normalized = points.map((point, index): ChartGeometryPoint => {
		const x = type === 'bar'
			? PLOT_LEFT + slot * index + slot / 2
			: points.length <= 1 ? (PLOT_LEFT + PLOT_RIGHT) / 2 : PLOT_LEFT + (plotWidth * index / (points.length - 1));
		const safeValue = point.value === null || !Number.isFinite(point.value) ? null : clamp(point.value, min, max);
		const y = safeValue === null ? PLOT_BOTTOM : PLOT_BOTTOM - ((safeValue - min) / (max - min)) * plotHeight;
		return {
			...point,
			x,
			y,
			barX: x - barWidth / 2,
			barY: y,
			barWidth,
			barHeight: safeValue === null ? 0 : Math.max(2, PLOT_BOTTOM - y),
			showLabel: index % labelEvery === 0 || index === points.length - 1,
		};
	});

	const lineCommands: string[] = [];
	let inRun = false;
	for (const point of normalized) {
		if (point.value === null) {
			inRun = false;
			continue;
		}
		lineCommands.push(`${inRun ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
		inRun = true;
	}

	const validPoints = normalized.filter((point) => point.value !== null);
	const areaPath = validPoints.length > 1 && validPoints.length === normalized.length
		? `${lineCommands.join(' ')} L ${validPoints.at(-1)!.x.toFixed(2)} ${PLOT_BOTTOM} L ${validPoints[0].x.toFixed(2)} ${PLOT_BOTTOM} Z`
		: '';
	const gridValues = Array.from({length: 5}, (_, index) => min + ((max - min) * index / 4));
	const grid = gridValues.reverse().map((value) => ({
		value,
		y: PLOT_BOTTOM - ((value - min) / (max - min)) * plotHeight,
	}));

	return {
		width: WIDTH,
		height: HEIGHT,
		plotTop: PLOT_TOP,
		plotBottom: PLOT_BOTTOM,
		plotLeft: PLOT_LEFT,
		plotRight: PLOT_RIGHT,
		min,
		max,
		points: normalized,
		grid,
		linePath: lineCommands.join(' '),
		areaPath,
		minWidth: type === 'line' ? Math.max(680, points.length * 27) : Math.max(520, points.length * 38),
	};
}

@Component({
	selector: 'app-learning-chart',
	template: `
		<div class="chart-scroll" [style.--chart-min-width.px]="geometry().minWidth">
			<div class="chart-canvas" [attr.aria-label]="ariaLabel()" role="img">
				<svg [attr.viewBox]="'0 0 ' + geometry().width + ' ' + geometry().height" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
					<defs>
						<linearGradient id="learning-chart-bar-gradient" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--mat-sys-primary)" stop-opacity=".96"/>
							<stop offset="100%" stop-color="var(--mat-sys-primary)" stop-opacity=".62"/>
						</linearGradient>
						<linearGradient id="learning-chart-area-gradient" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--mat-sys-primary)" stop-opacity=".20"/>
							<stop offset="100%" stop-color="var(--mat-sys-primary)" stop-opacity=".02"/>
						</linearGradient>
					</defs>

					@for(line of geometry().grid; track line.value) {
						<line class="grid-line" [attr.x1]="geometry().plotLeft" [attr.x2]="geometry().plotRight" [attr.y1]="line.y" [attr.y2]="line.y"/>
						<text class="axis-value" [attr.x]="geometry().plotLeft - 9" [attr.y]="line.y + 4" text-anchor="end">{{ formatAxis(line.value) }}</text>
					}

					@if (type() === 'bar') {
						@for(point of geometry().points; track point.key) {
							<g class="bar-point">
								<rect class="bar" rx="7" [attr.x]="point.barX" [attr.y]="point.barY" [attr.width]="point.barWidth" [attr.height]="point.barHeight">
									<title>{{ point.label }}: {{ formatValue(point.value) }}</title>
								</rect>
								@if (point.value !== null) {
									<text class="point-value" [attr.x]="point.x" [attr.y]="Math.max(14, point.barY - 8)" text-anchor="middle">{{ formatValue(point.value) }}</text>
								}
								<text class="x-label" [attr.x]="point.x" [attr.y]="geometry().plotBottom + 25" text-anchor="middle">{{ point.label }}</text>
							</g>
						}
					} @else {
						@if (geometry().areaPath) {
							<path class="area" [attr.d]="geometry().areaPath"/>
						}
						<path class="line" [attr.d]="geometry().linePath"/>
						@for(point of geometry().points; track point.key) {
							@if (point.value !== null) {
								<circle class="dot-halo" [attr.cx]="point.x" [attr.cy]="point.y" r="7"/>
								<circle class="dot" [attr.cx]="point.x" [attr.cy]="point.y" r="3.6">
									<title>{{ point.label }}: {{ formatValue(point.value) }}</title>
								</circle>
							}
							@if (point.showLabel) {
								<text class="x-label" [attr.x]="point.x" [attr.y]="geometry().plotBottom + 25" text-anchor="middle">{{ point.label }}</text>
							}
						}
					}
				</svg>
			</div>
		</div>
	`,
	styles: [`
		:host{display:block;min-width:0}.chart-scroll{overflow-x:auto;overflow-y:hidden;padding:2px 0 0;scrollbar-width:thin}.chart-canvas{min-width:var(--chart-min-width);width:100%;height:270px}.chart-canvas svg{display:block;width:100%;height:100%;overflow:visible}.grid-line{stroke:var(--mat-sys-outline-variant);stroke-width:1;stroke-dasharray:3 5}.axis-value,.x-label,.point-value{font-family:inherit;fill:var(--mat-sys-on-surface-variant)}.axis-value{font-size:10px}.x-label{font-size:10px}.point-value{font-size:11px;font-weight:700;fill:var(--mat-sys-on-surface)}.bar{fill:url(#learning-chart-bar-gradient);filter:drop-shadow(0 5px 7px color-mix(in srgb,var(--mat-sys-primary) 16%,transparent));transition:opacity .16s ease}.bar:hover{opacity:.82}.area{fill:url(#learning-chart-area-gradient)}.line{fill:none;stroke:var(--mat-sys-primary);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 3px 5px color-mix(in srgb,var(--mat-sys-primary) 18%,transparent))}.dot-halo{fill:var(--mat-sys-surface);stroke:var(--mat-sys-primary);stroke-width:1.5;opacity:.72}.dot{fill:var(--mat-sys-primary);stroke:var(--mat-sys-surface);stroke-width:1.5}.dot:hover{r:5}@media(max-width:700px){.chart-canvas{height:245px}.x-label{font-size:9px}.point-value{font-size:10px}}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningChartComponent {
	readonly type = input.required<LearningChartType>();
	readonly points = input.required<LearningChartPoint[]>();
	readonly min = input<number | null>(null);
	readonly max = input<number | null>(null);
	readonly suffix = input('');
	readonly ariaLabel = input('Learning chart');
	readonly Math = Math;
	readonly geometry = computed(() => buildLearningChartGeometry(this.points(), this.type(), this.min(), this.max()));

	formatAxis(value: number): string {
		return `${Math.round(value)}${this.suffix()}`;
	}

	formatValue(value: number | null): string {
		return value === null ? '—' : `${Math.round(value)}${this.suffix()}`;
	}
}
