import {
  afterNextRender,
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  DestroyRef,
  effect,
  ElementRef,
  EnvironmentInjector,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type NutrientViewerType from '@nutrient-sdk/viewer';
import type { Instance } from '@nutrient-sdk/viewer';
import { Pin, PinAction, PinCard } from './pin-card';

// Empty = trial mode (watermarked). Paste a Web SDK key to remove the watermark.
const LICENSE_KEY = '';

const SEED: Pin[] = [
  { id: 'pin-1', pageIndex: 0, x: 60, y: 150, label: 'Parties', status: 'open' },
  { id: 'pin-2', pageIndex: 0, x: 520, y: 420, label: 'Payment terms', status: 'flagged' },
  { id: 'pin-3', pageIndex: 1, x: 60, y: 560, label: 'Signature block', status: 'open' },
];

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private viewerEl = viewChild.required<ElementRef<HTMLElement>>('viewer');
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);

  protected pins = signal<Pin[]>(SEED);
  protected activeId = signal<string | null>(null);
  protected placing = signal(false);
  protected log = signal<string[]>([]);
  private ready = signal(false);

  private NV?: typeof NutrientViewerType;
  private instance?: Instance;
  private refs = new Map<string, ComponentRef<PinCard>>();

  constructor() {
    afterNextRender(async () => {
      const NV = (await import('@nutrient-sdk/viewer')).default;
      this.NV = NV;
      this.instance = await NV.load({
        container: this.viewerEl().nativeElement,
        document: '/document.pdf',
        useCDN: true, // WASM + fonts from Nutrient's CDN; see guides/web/self-host-assets to self-host
        licenseKey: LICENSE_KEY || undefined,
      });
      // Viewer -> Angular: pressing the page while "placing" drops a new pin there.
      this.instance.addEventListener('page.press', ({ pageIndex, point }) => {
        if (!this.placing()) return;
        this.placing.set(false);
        const pin: Pin = {
          id: crypto.randomUUID(),
          pageIndex,
          x: point.x - 12, // centre the 24px dot on the press point
          y: point.y - 24,
          label: `Note ${this.pins().length + 1}`,
          status: 'open',
        };
        this.pins.update((p) => [...p, pin]);
        this.activeId.set(pin.id);
        this.record(`Placed "${pin.label}" on page ${pageIndex + 1}`);
      });
      this.ready.set(true);
    });

    // Angular state -> overlays. One sync: mount new pins, push inputs to
    // existing ones, tear down removed ones.
    effect(() => {
      const pins = this.pins();
      const active = this.activeId();
      if (!this.ready()) return;
      untracked(() => {
        const ids = new Set(pins.map((p) => p.id));
        for (const [id, ref] of this.refs) {
          if (ids.has(id)) continue;
          this.instance!.removeCustomOverlayItem(id);
          ref.destroy();
          this.refs.delete(id);
        }
        pins.forEach((pin, i) => {
          const ref = this.refs.get(pin.id) ?? this.mount(pin);
          ref.setInput('pin', pin);
          ref.setInput('number', i + 1);
          ref.setInput('active', pin.id === active);
        });
      });
    });

    inject(DestroyRef).onDestroy(() => this.NV?.unload(this.viewerEl().nativeElement));
  }

  private mount(pin: Pin): ComponentRef<PinCard> {
    const NV = this.NV!;
    const ref = createComponent(PinCard, { environmentInjector: this.injector });
    // Attached to the app, so change detection and DI work even though the
    // SDK owns where the host element lives in the DOM.
    this.appRef.attachView(ref.hostView);
    ref.instance.action.subscribe((a) => this.onAction(a));
    this.refs.set(pin.id, ref);
    this.instance!.setCustomOverlayItem(
      new NV.CustomOverlayItem({
        id: pin.id,
        node: ref.location.nativeElement,
        pageIndex: pin.pageIndex,
        position: new NV.Geometry.Point({ x: pin.x, y: pin.y }),
      }),
    );
    return ref;
  }

  // Overlay -> Angular: every button in the overlay lands here.
  private onAction({ pin, type }: PinAction) {
    if (type === 'toggle') {
      this.activeId.set(this.activeId() === pin.id ? null : pin.id);
      return;
    }
    if (type === 'remove') {
      this.pins.update((p) => p.filter((x) => x.id !== pin.id));
    } else {
      const status = type === 'approve' ? 'approved' : 'flagged';
      this.pins.update((p) => p.map((x) => (x.id === pin.id ? { ...x, status } : x)));
    }
    this.record(`${type} -> "${pin.label}" (page ${pin.pageIndex + 1})`);
  }

  protected focus(pin: Pin) {
    this.activeId.set(pin.id);
    this.instance?.jumpToRect(
      pin.pageIndex,
      new this.NV!.Geometry.Rect({ left: pin.x - 100, top: pin.y - 100, width: 200, height: 200 }),
    );
  }

  private record(msg: string) {
    this.log.update((l) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 30));
  }
}
