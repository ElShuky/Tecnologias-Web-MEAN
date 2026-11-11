import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'dateLabel', standalone: true })
export class DateLabelPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return 'Selecciona una fecha';
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
}
