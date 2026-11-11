import { DateLabelPipe } from '../../shared/pipes/date-label.pipe';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { Booking } from '../../core/models/booking.model';
import { BookingService } from '../../core/services/booking.service';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [Button, Card, DateLabelPipe, RouterLink, StatusMessage],
  template: `
    <section class="page shell">
      <p class="eyebrow">Tu agenda</p>
      <h1 class="page-title">Mis reservas</h1>
      <p class="page-lead">Aquí encontrarás tus próximas visitas y el historial de atención.</p>

      @if (loading()) {
        <app-status-message title="Cargando reservas" message="Estamos consultando tu agenda." />
      } @else if (errorMessage()) {
        <app-status-message
          type="error"
          title="No se pudieron cargar tus reservas"
          [message]="errorMessage()"
        />
      } @else if (bookings().length === 0) {
        <app-status-message
          title="Aún no tienes reservas"
          message="Encuentra un servicio y agenda tu primera visita."
        />
        <a class="login-link" routerLink="/negocios"><app-button>Explorar negocios</app-button></a>
      } @else {
        <div class="booking-list">
          @for (booking of bookings(); track booking.id) {
            <app-card>
              <div class="booking-row">
                <div>
                  <span class="booking-date">{{ booking.fecha | dateLabel }}</span>
                  <h2>{{ booking.negocioNombre || 'Negocio' }}</h2>
                  <p>{{ booking.servicioNombre || 'Servicio' }} · {{ booking.hora }}</p>
                  @if (booking.notas) {
                    <small>{{ booking.notas }}</small>
                  }
                  @if (booking.respuestas && booking.respuestas.length > 0) {
                    <div class="booking-answers">
                      @for (ans of booking.respuestas; track ans.campoId) {
                        <small>
                          <strong>{{ ans.etiqueta }}:</strong> {{ formatAnswerValue(ans.valor) }}
                        </small>
                      }
                    </div>
                  }
                </div>
                <div class="booking-actions">
                  <span class="booking-state" [class.is-cancelled]="booking.estado === 'cancelada'">
                    {{ booking.estado === 'confirmada' ? 'Confirmada' : 'Cancelada' }}
                  </span>
                  @if (booking.estado === 'confirmada') {
                    <app-button
                      variant="ghost"
                      (click)="cancel(booking)"
                      [disabled]="cancellingId() === booking.id"
                    >
                      {{ cancellingId() === booking.id ? 'Cancelando...' : 'Cancelar' }}
                    </app-button>
                  }
                </div>
              </div>
            </app-card>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './my-bookings.scss',
})
export class MyBookings implements OnInit {
  private readonly bookingService = inject(BookingService);
  protected readonly bookings = signal<Booking[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly cancellingId = signal('');

  ngOnInit(): void {
    this.bookingService.listMine().subscribe({
      next: (response) => {
        this.bookings.set(response.data);
        this.loading.set(false);
      },
      error: (error: ApiErrorResponse) => {
        this.errorMessage.set(error.error?.message ?? 'No se pudieron cargar tus reservas.');
        this.loading.set(false);
      },
    });
  }

  protected cancel(booking: Booking): void {
    this.cancellingId.set(booking.id);
    this.bookingService.cancel(booking.id).subscribe({
      next: () => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === booking.id ? { ...item, estado: 'cancelada' } : item)),
        );
        this.cancellingId.set('');
      },
      error: () => this.cancellingId.set(''),
    });
  }

  protected formatAnswerValue(valor: string | number | boolean | string[]): string {
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (Array.isArray(valor)) return valor.join(', ');
    return String(valor);
  }
}
