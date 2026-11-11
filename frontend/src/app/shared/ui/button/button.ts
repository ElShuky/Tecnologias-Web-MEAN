import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `<button
    [class]="'button button--' + variant()"
    [type]="type()"
    [disabled]="disabled()"
  >
    <ng-content />
  </button>`,
  styleUrl: './button.scss',
})
export class Button {
  readonly variant = input<'primary' | 'secondary' | 'ghost'>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
}
