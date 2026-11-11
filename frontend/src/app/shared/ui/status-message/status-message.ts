import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-message',
  standalone: true,
  template: `
    <div class="status" [class]="'status status--' + type()" role="status">
      <strong>{{ title() }}</strong>
      <span>{{ message() }}</span>
    </div>
  `,
  styleUrl: './status-message.scss',
})
export class StatusMessage {
  readonly type = input<'info' | 'success' | 'warning' | 'error'>('info');
  readonly title = input('Información');
  readonly message = input('');
}
