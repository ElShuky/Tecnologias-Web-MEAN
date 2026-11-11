import { DateLabelPipe } from '../../shared/pipes/date-label.pipe';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { Booking } from '../../core/models/booking.model';
import { Business } from '../../core/models/business.model';
import { BusinessServiceItem } from '../../core/models/service.model';
import { BookingService } from '../../core/services/booking.service';
import { BusinessService } from '../../core/services/business.service';
import { AuthService } from '../../core/services/auth.service';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-reservation-management',
  standalone: true,
  imports: [Button, Card, DateLabelPipe, RouterLink, StatusMessage],
  template: `
    <section class="page shell management-page">
      <a class="back-link" [routerLink]="isSuperadmin ? ['/panel/superadmin'] : ['/panel/admin']">
        ← Volver al panel
      </a>
      <p class="eyebrow">Agenda del negocio</p>
      @if (business(); as activeBusiness) {
        <h1 class="page-title">{{ activeBusiness.nombre }}</h1>
        <p class="page-lead">Consulta y administra las reservas autorizadas de este negocio.</p>

        <app-card>
          <div class="filters">
            <label>
              <span>Filtrar por día</span>
              <input type="date" [value]="dateFilter()" (change)="changeDate($event)" />
            </label>
            <label>
              <span>Servicio</span>
              <select [value]="serviceFilter()" (change)="changeService($event)">
                <option value="">Todos los servicios</option>
                @for (service of services(); track service.id) {
                  <option [value]="service.id">{{ service.nombre }}</option>
                }
              </select>
            </label>
            <button type="button" class="clear-filter" (click)="clearDate()">Ver semana</button>
          </div>
          <p class="filter-caption">
            {{
              dateFilter()
                ? 'Reservas del ' + (dateFilter() | dateLabel)
                : 'Reservas de la semana actual'
            }}
          </p>
        </app-card>

        @if (loading()) {
          <app-status-message
            title="Cargando reservas"
            message="Consultando la agenda del negocio."
          />
        } @else if (errorMessage()) {
          <app-status-message
            type="error"
            title="No se pudo cargar la agenda"
            [message]="errorMessage()"
          />
        } @else if (visibleBookings().length === 0) {
          <app-status-message
            title="No hay reservas"
            message="No existen reservas para el filtro seleccionado."
          />
        } @else {
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Servicio</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (booking of visibleBookings(); track booking.id) {
                  <tr>
                    <td>{{ booking.fecha | dateLabel }}</td>
                    <td>
                      <strong>{{ booking.hora }}</strong>
                    </td>
                    <td>
                      {{ booking.servicioNombre || 'Servicio' }}
                      @if (booking.respuestas && booking.respuestas.length > 0) {
                        <div class="booking-answers">
                          @for (ans of booking.respuestas; track ans.campoId) {
                            <small class="muted" style="display: block">
                              <strong>{{ ans.etiqueta }}:</strong>
                              {{ formatAnswerValue(ans.valor) }}
                            </small>
                          }
                        </div>
                      }
                    </td>
                    <td>{{ booking.clienteNombre || booking.clienteCorreo || 'Cliente' }}</td>
                    <td>
                      <span
                        class="booking-state"
                        [class.is-cancelled]="booking.estado === 'cancelada'"
                      >
                        {{ booking.estado === 'confirmada' ? 'Confirmada' : 'Cancelada' }}
                      </span>
                    </td>
                    <td>
                      @if (booking.estado === 'confirmada') {
                        <app-button
                          variant="ghost"
                          [disabled]="cancellingId() === booking.id"
                          (click)="cancel(booking)"
                        >
                          {{ cancellingId() === booking.id ? 'Cancelando...' : 'Cancelar' }}
                        </app-button>
                      } @else {
                        <span class="muted">Sin acciones</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else if (loading()) {
        <app-status-message title="Cargando negocio" message="Estamos preparando la agenda." />
      } @else {
        <app-status-message type="error" title="Negocio no disponible" [message]="errorMessage()" />
      }
    </section>
  `,
  styleUrl: './reservation-management.scss',
})
export class ReservationManagement implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly businessService = inject(BusinessService);
  private readonly bookingService = inject(BookingService);
  protected readonly business = signal<Business | null>(null);
  protected readonly bookings = signal<Booking[]>([]);
  protected readonly services = signal<BusinessServiceItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly cancellingId = signal('');
  protected readonly dateFilter = signal('');
  protected readonly serviceFilter = signal('');
  protected isSuperadmin = false;
  private businessId = '';

  ngOnInit(): void {
    const user = this.auth.currentUser();
    this.isSuperadmin = user?.rol === 'superadmin';
    this.businessId = this.route.snapshot.queryParamMap.get('businessId') || user?.negocioId || '';
    if (!this.businessId) {
      this.errorMessage.set('No se indicó un negocio para consultar.');
      this.loading.set(false);
      return;
    }
    this.businessService.getForManagement(this.businessId).subscribe({
      next: (response) => {
        this.business.set(response.data);
        this.businessService.listManagedServices(this.businessId).subscribe({
          next: (services) => this.services.set(services.data),
        });
        this.loadBookings();
      },
      error: (error: ApiErrorResponse) => this.fail(error),
    });
  }

  protected changeDate(event: Event): void {
    this.dateFilter.set((event.target as HTMLInputElement).value);
    this.loadBookings();
  }

  protected clearDate(): void {
    this.dateFilter.set('');
    this.loadBookings();
  }

  protected changeService(event: Event): void {
    this.serviceFilter.set((event.target as HTMLSelectElement).value);
  }

  protected visibleBookings(): Booking[] {
    const serviceId = this.serviceFilter();
    return serviceId
      ? this.bookings().filter((booking) => booking.servicioId === serviceId)
      : this.bookings();
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

  private loadBookings(): void {
    this.loading.set(true);
    const filter = this.dateFilter()
      ? { fecha: this.dateFilter() }
      : { semana: this.formatDate(new Date()) };
    this.bookingService.listBusiness(this.businessId, filter).subscribe({
      next: (response) => {
        this.bookings.set(response.data);
        this.loading.set(false);
      },
      error: (error: ApiErrorResponse) => this.fail(error),
    });
  }

  private fail(error: ApiErrorResponse): void {
    this.errorMessage.set(error.error?.message ?? 'No se pudo cargar la información.');
    this.loading.set(false);
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  protected formatAnswerValue(valor: string | number | boolean | string[]): string {
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (Array.isArray(valor)) return valor.join(', ');
    return String(valor);
  }
}
