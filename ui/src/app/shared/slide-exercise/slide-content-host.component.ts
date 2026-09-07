import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import type { SlideContentComponent, SlideContentEvent } from './slide-content-contracts';
import type { SlideContentRegistry } from './slide-content-registry';
import type { SlideExerciseRuntimeState, SlideExerciseSlide } from './slide-exercise.models';

@Component({
  selector: 'app-slide-content-host',
  standalone: true,
  templateUrl: './slide-content-host.component.html',
  styleUrl: './slide-content-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideContentHostComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) slide!: SlideExerciseSlide;
  @Input({ required: true }) registry!: SlideContentRegistry;
  @Output() readonly stateChange = new EventEmitter<SlideExerciseRuntimeState>();
  @Output() readonly event = new EventEmitter<SlideContentEvent>();
  @ViewChild('outlet', { read: ViewContainerRef, static: true }) private outlet!: ViewContainerRef;

  rendererLoading = false;
  rendererLoadFailed = false;
  unsupportedType = '';
  private readonly changeDetector = inject(ChangeDetectorRef);
  private componentRef: ComponentRef<SlideContentComponent> | null = null;
  private stateSubscription: Subscription | null = null;
  private eventSubscription: Subscription | null = null;
  private initialized = false;
  private renderVersion = 0;

  ngOnInit(): void {
    this.initialized = true;
    void this.render();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.initialized) void this.render();
  }

  ngOnDestroy(): void {
    this.renderVersion += 1;
    this.disposeRenderer();
  }

  retry(): void {
    void this.render();
  }

  handleAction(actionId: string): void {
    this.componentRef?.instance.handleAction?.(actionId);
  }

  private async render(): Promise<void> {
    const version = ++this.renderVersion;
    this.disposeRenderer();
    this.rendererLoadFailed = false;
    this.unsupportedType = '';
    this.stateChange.emit({});
    const renderer = this.registry.resolve(this.slide.type);
    if (!renderer) {
      this.unsupportedType = this.slide.type;
      this.changeDetector.markForCheck();
      return;
    }

    this.rendererLoading = true;
    this.changeDetector.markForCheck();
    try {
      const component = await renderer.loadComponent();
      if (version !== this.renderVersion) return;
      this.componentRef = this.outlet.createComponent(component);
      this.componentRef.instance.load({
        slideId: this.slide.id,
        type: this.slide.type,
        data: this.slide.data,
      });
      const stateChange = this.componentRef.instance.stateChange;
      if (stateChange) this.stateSubscription = stateChange.subscribe((state) => this.stateChange.emit(state));
      const event = this.componentRef.instance.event;
      if (event) this.eventSubscription = event.subscribe((value) => this.event.emit(value));
      this.rendererLoading = false;
      this.changeDetector.markForCheck();
    } catch {
      if (version !== this.renderVersion) return;
      this.rendererLoading = false;
      this.rendererLoadFailed = true;
      this.changeDetector.markForCheck();
    }
  }

  private disposeRenderer(): void {
    this.stateSubscription?.unsubscribe();
    this.stateSubscription = null;
    this.eventSubscription?.unsubscribe();
    this.eventSubscription = null;
    this.outlet?.clear();
    this.componentRef = null;
  }
}
