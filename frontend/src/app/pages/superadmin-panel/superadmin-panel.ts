import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService } from '../../core/services/business.service';
import { Business } from '../../core/models/business.model';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-superadmin-panel',
  standalone: true,
  imports: [Button, Card, RouterLink, StatusMessage],
  template: `
    <section class="page shell panel-page">
      <p class="eyebrow">Administración global</p>
      <h1 class="page-title">Panel del proyecto</h1>
      <p class="page-lead">Supervisa los negocios y sus enlaces públicos.</p>
      <a class="register-link" routerLink="/registro-negocio"
        ><app-button>Registrar negocio</app-button></a
      >

      @if (errorMessage()) {
        <app-status-message
          type="error"
          title="No se pudieron cargar los negocios"
          [message]="errorMessage()"
        />
      } @else if (businesses().length === 0) {
        <app-status-message
          title="Aún no hay negocios"
          message="Registra el primer negocio para comenzar."
        />
      }

      <div class="business-grid">
        @for (business of businesses(); track business.id) {
          <app-card>
            <span class="business-category">{{ business.rubro }}</span>
            <h2>{{ business.nombre }}</h2>
            <p>{{ business.descripcion || 'Sin descripción disponible.' }}</p>
            <a [routerLink]="['/panel/reservas']" [queryParams]="{ businessId: business.id }">
              Ver reservas y servicios
            </a>
            <a [href]="business.enlacePublico" target="_blank" rel="noopener">
              Ver enlace público
            </a>
          </app-card>
        }
      </div>
      <app-button variant="ghost" (click)="logout()">Cerrar sesión</app-button>
    </section>
  `,
  styleUrl: './superadmin-panel.scss',
})
export class SuperadminPanel implements OnInit {
  private readonly businessService = inject(BusinessService);
  private readonly auth = inject(AuthService);
  protected readonly businesses = signal<Business[]>([]);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.businessService.list().subscribe({
      next: (response) => this.businesses.set(response.data),
      error: (error: ApiErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'No se pudieron cargar los negocios.'),
    });
  }

  protected logout(): void {
    this.auth.logout();
  }
}
