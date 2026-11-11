import { Component, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  standalone: true,
  template: `
    <div class="form-field">
      <span>{{ label() }}</span>
      <ng-content />
      @if (hint()) {
        <small>{{ hint() }}</small>
      }
    </div>
  `,
  styleUrl: './form-field.scss',
})
export class FormField {
  readonly label = input('');
  readonly hint = input('');
}
