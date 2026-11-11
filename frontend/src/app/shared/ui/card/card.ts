import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <article class="card" [class.card--interactive]="interactive()">
      <ng-content />
    </article>
  `,
  styleUrl: './card.scss',
})
export class Card {
  readonly interactive = input(false);
}
