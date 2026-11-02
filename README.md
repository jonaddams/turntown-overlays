# Angular components as Nutrient Web SDK overlays

Sample for turntown.digital. It renders **live Angular components** at fixed
spots on a PDF with Nutrient Web SDK
[`CustomOverlayItem`](https://www.nutrient.io/api/web/classes/NutrientViewer.CustomOverlayItem.html).
The components scroll and zoom with the page, and their buttons send events
back into the Angular app.

```bash
pnpm install
pnpm start        # http://localhost:4200
```

Requires Node 22.12+. Angular 21, `@nutrient-sdk/viewer` 1.25. With no license
key it runs in trial mode with a watermark. Set `LICENSE_KEY` in
`src/app/app.ts` to remove it.

## What to try

- Click a numbered pin to open its Angular card. **Approve / Flag / Remove**
  update the sidebar and the event log.
- Click a pin in the sidebar to scroll the viewer to it and highlight it
  (Angular → overlay).
- Click **+ Add pin**, then click anywhere on the document. The viewer's
  `page.press` event gives the page index and the point in PDF coordinates.

## How it works (`src/app/app.ts`)

```ts
const ref = createComponent(PinCard, { environmentInjector: this.injector });
this.appRef.attachView(ref.hostView);                 // change detection + DI keep working
ref.instance.action.subscribe((a) => this.onAction(a)); // overlay → app events
ref.setInput('pin', pin);                              // app → overlay state

instance.setCustomOverlayItem(new NutrientViewer.CustomOverlayItem({
  id: pin.id,
  node: ref.location.nativeElement,                    // the Angular host element
  pageIndex: pin.pageIndex,
  position: new NutrientViewer.Geometry.Point({ x: pin.x, y: pin.y }), // PDF points, top-left origin
}));

// teardown
instance.removeCustomOverlayItem(pin.id);
ref.destroy();
```

A single `effect()` syncs the `pins` signal to the overlays. It mounts new
pins, pushes inputs to existing ones, and removes deleted ones.

## Gotchas this sample handles

1. **Styles**: the viewer renders inside a shadow root, so component CSS that
   Angular puts in `<head>` (the default `Emulated` encapsulation) never
   reaches the overlay. The overlay component uses
   `encapsulation: ViewEncapsulation.ShadowDom` (`src/app/pin-card.ts`).
2. **Clicks**: without help, a click inside an overlay also fires the
   viewer's `page.press` and starts text selection. The component's host
   stops `pointerup`/`pointerdown` propagation. See
   [Handling clicks on custom overlays](https://www.nutrient.io/guides/web/knowledge-base/handling-clicks-on-custom-overlays/).
3. **Lazy mounting**: the SDK only puts an overlay's node in the DOM while its
   page is rendered. The component instance stays alive (it's attached to
   `ApplicationRef`), so its state survives scrolling away and back.
4. **Zoom**: overlays scale with the page by default (CSS transform). If a
   component should stay a fixed screen size, pass `disableAutoZoom: true`.
5. **Assets**: `useCDN: true` loads the WASM from Nutrient's CDN. To
   self-host, see [Self-host assets](https://www.nutrient.io/guides/web/self-host-assets)
   and set `baseUrl`.
