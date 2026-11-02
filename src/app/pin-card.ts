import { DecimalPipe } from '@angular/common';
import { Component, input, output, signal, ViewEncapsulation } from '@angular/core';

export interface Pin {
  id: string;
  pageIndex: number;
  /** Top-left of the pin in PDF page space (points, origin top-left). */
  x: number;
  y: number;
  label: string;
  status: 'open' | 'approved' | 'flagged';
}

export interface PinAction {
  pin: Pin;
  type: 'approve' | 'flag' | 'remove' | 'toggle';
}

/**
 * Rendered by Angular, positioned by Nutrient. The App creates this with
 * createComponent() and hands its host element to a CustomOverlayItem, so it
 * scrolls/zooms with the page while staying a normal Angular component.
 */
@Component({
  selector: 'pin-card',
  // The viewer renders inside its own shadow root, so styles Angular puts in
  // <head> (the default Emulated mode) never reach this node. ShadowDom
  // encapsulation ships the styles with the component instead.
  encapsulation: ViewEncapsulation.ShadowDom,
  host: {
    // Without this, a click inside the overlay also fires the viewer's
    // `page.press` (it listens on pointerup) and starts text selection.
    '(pointerup)': '$event.stopPropagation()',
    '(pointerdown)': '$event.stopPropagation()',
  },
  template: `
    <button
      class="dot {{ pin().status }}"
      [class.active]="active()"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'Pin ' + number() + ': ' + pin().label"
      (click)="open.set(!open()); action.emit({ pin: pin(), type: 'toggle' })"
    >{{ number() }}</button>

    @if (open() || active()) {
      <div class="card" [class.flip]="pin().x > 306" role="dialog" [attr.aria-label]="pin().label">
        <header>
          <strong>{{ pin().label }}</strong>
          <span class="status {{ pin().status }}">{{ pin().status }}</span>
        </header>
        <p>Page {{ pin().pageIndex + 1 }} · ({{ pin().x | number: '1.0-0' }}, {{ pin().y | number: '1.0-0' }})</p>
        <div class="actions">
          <button class="approve" [attr.aria-pressed]="pin().status === 'approved'"
            (click)="action.emit({ pin: pin(), type: 'approve' })">Approve</button>
          <button class="flag" [attr.aria-pressed]="pin().status === 'flagged'"
            (click)="action.emit({ pin: pin(), type: 'flag' })">Flag</button>
          <button (click)="action.emit({ pin: pin(), type: 'remove' })">Remove</button>
        </div>
      </div>
    }
  `,
  imports: [DecimalPipe],
  styles: `
    :host { position: relative; display: block; font: 12px/1.3 system-ui, sans-serif; }
    .dot {
      width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 2px solid #fff;
      background: #4537de; color: #fff; font-weight: 700; cursor: pointer;
      box-shadow: 0 2px 6px rgb(0 0 0 / .35); padding: 0;
    }
    .dot.approved { background: #12805c; }
    .dot.flagged { background: #c2410c; }
    .dot.active { outline: 3px solid #fbbf24; outline-offset: 2px; }
    .card {
      position: absolute; top: 0; left: 32px; width: 200px; padding: 10px;
      background: #fff; color: #1a1a1a; border-radius: 8px;
      box-shadow: 0 6px 20px rgb(0 0 0 / .25); z-index: 1;
    }
    .card.flip { left: auto; right: 32px; }
    header { display: flex; justify-content: space-between; gap: 6px; align-items: center; }
    p { margin: 4px 0 8px; color: #666; }
    .status { text-transform: capitalize; font-size: 11px; padding: 1px 6px; border-radius: 9px; background: #eee; }
    .status.approved { background: #d1fae5; color: #065f46; }
    .status.flagged { background: #ffedd5; color: #9a3412; }
    .actions { display: flex; gap: 4px; }
    .actions button {
      flex: 1; font: inherit; padding: 4px; border-radius: 4px; cursor: pointer;
      border: 1px solid #ccc; background: #fff; color: #555;
    }
    .actions button:hover { border-color: #4537de; color: #4537de; }
    .actions .approve[aria-pressed='true'] { background: #12805c; border-color: #12805c; color: #fff; }
    .actions .flag[aria-pressed='true'] { background: #c2410c; border-color: #c2410c; color: #fff; }
  `,
})
export class PinCard {
  pin = input.required<Pin>();
  number = input.required<number>();
  active = input(false);
  action = output<PinAction>();
  protected open = signal(false);
}
