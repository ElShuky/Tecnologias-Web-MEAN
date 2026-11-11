import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Business } from '../../core/models/business.model';
import {
  BusinessServiceItem,
  ServiceFormField,
  ServiceFormFieldType,
} from '../../core/models/service.model';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService } from '../../core/services/business.service';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [Button, Card, CurrencyPipe, RouterLink, StatusMessage],
  template: `
    <section
      class="page shell service-detail"
      [style.--primary]="primaryColor()"
      [style.--secondary]="secondaryColor()"
      [style.--business-primary]="primaryColor()"
      [style.--business-secondary]="secondaryColor()"
    >
      @if (loading()) {
        <app-status-message title="Cargando servicio" message="Estamos preparando el detalle." />
      } @else if (errorMessage()) {
        <app-status-message
          type="error"
          title="No se pudo cargar el servicio"
          [message]="errorMessage()"
        />
      } @else if (service(); as activeService) {
        <a class="back-link" [routerLink]="['/negocios', slug]">← Volver a los servicios</a>
        @if (business(); as activeBusiness) {
          <div class="business-banner">
            <div class="business-cover-stage">
              @if (coverUrl(activeBusiness); as cover) {
                <img
                  class="business-cover"
                  [src]="cover"
                  [alt]="'Portada de ' + activeBusiness.nombre"
                />
              }
              <div class="business-cover-overlay"></div>
              @if (logoUrl(activeBusiness); as logo) {
                <div class="business-logo-badge">
                  <img
                    class="business-logo"
                    [src]="logo"
                    [alt]="'Logotipo de ' + activeBusiness.nombre"
                  />
                </div>
              }
            </div>
            <div class="business-brand">
              <span class="business-rubro-pill">{{ activeBusiness.rubro }}</span>
              <strong>{{ activeBusiness.nombre }}</strong>
            </div>
          </div>
        }
        <app-card>
          <p class="eyebrow">Detalle del servicio</p>
          <h1 class="page-title">{{ activeService.nombre }}</h1>
          <p class="page-lead">
            {{ activeService.descripcion || 'Reserva este servicio en el horario que prefieras.' }}
          </p>
          <div class="detail-meta">
            <div>
              <span>Duración</span><strong>{{ activeService.duracionMin }} minutos</strong>
            </div>
            <div>
              <span>Precio</span
              ><strong>{{
                activeService.precio | currency: 'CLP' : 'symbol-narrow' : '1.0-0'
              }}</strong>
            </div>
          </div>

          @if (formFields().length > 0) {
            <div class="service-custom-form-preview">
              <h3>Datos solicitados para este servicio</h3>
              <p class="form-preview-lead">
                Al reservar este servicio, el negocio solicita la siguiente información:
              </p>
              <div class="custom-fields-list">
                @for (campo of formFields(); track campo.id || campo.etiqueta) {
                  <div class="custom-field-item">
                    <div class="custom-field-header">
                      <strong>{{ campo.etiqueta }}</strong>
                      <div class="custom-field-badges">
                        <span class="field-type-badge">{{ fieldTypeLabel(campo.tipo) }}</span>
                        @if (campo.obligatorio) {
                          <span class="field-req-badge">Obligatorio</span>
                        } @else {
                          <span class="field-opt-badge">Opcional</span>
                        }
                      </div>
                    </div>
                    @if (campo.textoAyuda) {
                      <small class="field-help">{{ campo.textoAyuda }}</small>
                    }
                    @if (campo.opciones && campo.opciones.length > 0) {
                      <div class="field-options">
                        @for (opt of campo.opciones; track opt) {
                          <span class="field-option-chip">{{ opt }}</span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <a
            class="reserve-link"
            [routerLink]="['/reservas/nueva']"
            [queryParams]="{ slug, serviceId: activeService.id }"
          >
            <app-button>Reservar este servicio</app-button>
          </a>
          @if (isBusinessAdmin()) {
            <a
              class="reserve-link"
              style="margin-left: 0.75rem"
              [routerLink]="['/panel/servicios', activeService.id, 'formulario']"
            >
              <app-button variant="ghost">Formulario del servicio</app-button>
            </a>
          }
        </app-card>
      }
    </section>
  `,
  styleUrl: './service-detail.scss',
})
export class ServiceDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly businessService = inject(BusinessService);
  protected readonly service = signal<BusinessServiceItem | null>(null);
  protected readonly business = signal<Business | null>(null);
  protected readonly formFields = signal<ServiceFormField[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected slug = '';

  private readonly typeLabels: Record<ServiceFormFieldType, string> = {
    texto_corto: 'Texto corto',
    texto_largo: 'Texto largo',
    numero: 'Número',
    fecha: 'Fecha',
    si_no: 'Sí / No',
    seleccion_unica: 'Selección única',
    seleccion_multiple: 'Selección múltiple',
  };

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    const serviceId = this.route.snapshot.paramMap.get('serviceId') ?? '';
    forkJoin({
      business: this.businessService.getPublic(this.slug),
      service: this.businessService.getService(this.slug, serviceId),
      form: this.businessService
        .getServiceForm(serviceId)
        .pipe(catchError(() => of({ success: true, data: { servicioId: serviceId, campos: [] } }))),
    }).subscribe({
      next: (response) => {
        this.business.set(response.business.data);
        this.service.set(response.service.data);
        this.formFields.set(response.form.data.campos ?? []);
        this.loading.set(false);
      },
      error: (error: ApiErrorResponse) => {
        this.errorMessage.set(error.error?.message ?? 'No se pudo cargar el servicio.');
        this.loading.set(false);
      },
    });
  }

  protected fieldTypeLabel(tipo: ServiceFormFieldType): string {
    return this.typeLabels[tipo] || tipo;
  }

  protected isBusinessAdmin(): boolean {
    const user = this.auth.currentUser();
    const activeBusiness = this.business();
    return Boolean(user?.rol === 'admin' && activeBusiness && user.negocioId === activeBusiness.id);
  }

  protected primaryColor(): string {
    return this.business()?.personalizacion?.colorPrimario || '#2F6F78';
  }

  protected secondaryColor(): string {
    return this.business()?.personalizacion?.colorSecundario || '#B77942';
  }

  protected logoUrl(activeBusiness: Business): string | null {
    return activeBusiness.personalizacion?.logo || activeBusiness.logoUrl || null;
  }

  protected coverUrl(activeBusiness: Business): string | null {
    return activeBusiness.personalizacion?.portada || activeBusiness.portadaUrl || null;
  }
}
