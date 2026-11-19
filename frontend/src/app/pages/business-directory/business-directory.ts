import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Business, BusinessRubro } from '../../core/models/business.model';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { BusinessService } from '../../core/services/business.service';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { FormField } from '../../shared/ui/form-field/form-field';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-business-directory',
  standalone: true,
  imports: [Button, Card, FormField, FormsModule, RouterLink, StatusMessage],
  template: `
    <section class="page shell">
      <p class="eyebrow">Directorio</p>
      <h1 class="page-title">Encuentra el negocio ideal.</h1>
      <p class="page-lead">Busca por nombre o filtra por rubro para comenzar tu reserva.</p>

      <form class="filters" (ngSubmit)="search()">
        <app-form-field label="Buscar">
          <input
            [(ngModel)]="searchTerm"
            name="search"
            type="search"
            placeholder="Ej. Barbería Central"
          />
        </app-form-field>
        <app-form-field label="Rubro">
          <select [(ngModel)]="category" name="category" (change)="search()">
            <option value="">Todos los rubros</option>
            @for (rubro of rubros(); track rubro.clave) {
              <option [value]="rubro.clave">{{ rubro.nombre }}</option>
            }
          </select>
        </app-form-field>
        <app-button type="submit">Buscar negocios</app-button>
      </form>

      @if (loading()) {
        <app-status-message
          title="Cargando negocios"
          message="Estamos buscando opciones disponibles."
        />
      } @else if (errorMessage()) {
        <app-status-message
          type="error"
          title="No se pudo cargar el directorio"
          [message]="errorMessage()"
        />
      } @else if (businesses().length === 0) {
        <app-status-message
          title="No encontramos resultados"
          message="Prueba con otro nombre o rubro."
        />
      } @else {
        <div class="business-grid">
          @for (business of businesses(); track business.id) {
            <app-card [interactive]="true">
              <div
                class="directory-card"
                [style.--business-primary]="business.personalizacion?.colorPrimario || '#2F6F78'"
                [style.--business-secondary]="
                  business.personalizacion?.colorSecundario || '#B77942'
                "
              >
                <div class="business-cover-stage">
                  @if (business.personalizacion?.portada || business.portadaUrl; as cover) {
                    <img
                      class="business-cover"
                      [src]="cover"
                      [alt]="'Portada de ' + business.nombre"
                    />
                  }
                  <div class="business-cover-overlay"></div>
                  @if (business.personalizacion?.logo || business.logoUrl; as logo) {
                    <div class="business-logo-badge">
                      <img
                        class="business-logo"
                        [src]="logo"
                        [alt]="'Logotipo de ' + business.nombre"
                      />
                    </div>
                  }
                </div>
                <span class="business-category">{{ business.rubro }}</span>
                <h2>{{ business.nombre }}</h2>
                <p>
                  {{ business.descripcion || 'Consulta sus servicios y horarios disponibles.' }}
                </p>
                <a class="business-link" [routerLink]="['/negocios', business.slug]">
                  Ver servicios <span aria-hidden="true">→</span>
                </a>
              </div>
            </app-card>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './business-directory.scss',
})
export class BusinessDirectory implements OnInit {
  private readonly businessService = inject(BusinessService);
  protected readonly businesses = signal<Business[]>([]);
  protected readonly rubros = signal<BusinessRubro[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected searchTerm = '';
  protected category = '';

  ngOnInit(): void {
    this.loadRubros();
    this.search();
  }

  protected loadRubros(): void {
    this.businessService.listRubros().subscribe({
      next: (response) => {
        this.rubros.set(response.data);
      },
      error: () => {
        this.rubros.set([]);
      },
    });
  }

  protected search(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.businessService.list(this.searchTerm, this.category).subscribe({
      next: (response) => {
        this.businesses.set(response.data);
        this.loading.set(false);
      },
      error: (error: ApiErrorResponse) => {
        this.errorMessage.set(error.error?.message ?? 'No se pudo cargar el directorio.');
        this.loading.set(false);
      },
    });
  }
}
