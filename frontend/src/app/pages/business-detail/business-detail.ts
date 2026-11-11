import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Business } from '../../core/models/business.model';
import { BusinessServiceItem } from '../../core/models/service.model';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { BusinessService } from '../../core/services/business.service';
import { AuthService } from '../../core/services/auth.service';
import { FollowingService } from '../../core/services/following.service';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [Button, Card, CurrencyPipe, RouterLink, StatusMessage],
  template: `
    <section
      class="page shell business-page"
      [style.--primary]="primaryColor()"
      [style.--secondary]="secondaryColor()"
      [style.--business-primary]="primaryColor()"
      [style.--business-secondary]="secondaryColor()"
    >
      @if (loading()) {
        <app-status-message title="Cargando negocio" message="Estamos preparando sus servicios." />
      } @else if (errorMessage()) {
        <app-status-message
          type="error"
          title="No se pudo cargar el negocio"
          [message]="errorMessage()"
        />
      } @else if (business(); as activeBusiness) {
        <a class="back-link" routerLink="/negocios">← Volver al directorio</a>
        <div class="business-hero">
          <div class="business-cover-stage" [class.has-cover]="!!coverUrl(activeBusiness)">
            @if (coverUrl(activeBusiness); as cover) {
              <img
                class="business-cover"
                [src]="cover"
                [alt]="'Portada de ' + activeBusiness.nombre"
              />
            }
            <div class="business-cover-overlay"></div>
          </div>
          <div class="business-heading">
            <div class="business-logo-badge">
              @if (logoUrl(activeBusiness); as logo) {
                <img
                  class="business-logo"
                  [src]="logo"
                  [alt]="'Logotipo de ' + activeBusiness.nombre"
                />
              } @else {
                <div class="business-logo-placeholder">
                  {{ activeBusiness.nombre.slice(0, 1).toUpperCase() }}
                </div>
              }
            </div>
            <div class="business-heading-content">
              <span class="business-rubro-badge">{{ activeBusiness.rubro }}</span>
              <h1 class="page-title">{{ activeBusiness.nombre }}</h1>
              <p class="page-lead">
                {{ activeBusiness.descripcion || 'Servicios disponibles para reservar.' }}
              </p>
            </div>
            @if (isClient()) {
              <div class="business-heading-actions">
                <app-button
                  variant="secondary"
                  [disabled]="followingLoading()"
                  (click)="toggleFollowing()"
                >
                  {{
                    followingLoading()
                      ? 'Actualizando...'
                      : following()
                        ? 'Dejar de seguir'
                        : 'Seguir negocio'
                  }}
                </app-button>
              </div>
            }
          </div>
        </div>

        <div class="section-header">
          <h2 class="section-title">Servicios activos</h2>
          <span class="section-accent"></span>
        </div>
        @if (services().length === 0) {
          <app-status-message
            title="No hay servicios disponibles"
            message="Este negocio aún no tiene servicios activos."
          />
        } @else {
          <div class="service-grid">
            @for (service of services(); track service.id) {
              <app-card [interactive]="true">
                <div class="service-card-inner">
                  <div class="service-card-top">
                    <h3>{{ service.nombre }}</h3>
                    <span class="service-duration">{{ service.duracionMin }} min</span>
                  </div>
                  <p>{{ service.descripcion || 'Servicio disponible para reservar.' }}</p>
                  <div class="service-meta">
                    <span class="service-price-label">Valor</span>
                    <strong>{{
                      service.precio | currency: 'CLP' : 'symbol-narrow' : '1.0-0'
                    }}</strong>
                  </div>
                  <a
                    class="service-link"
                    [routerLink]="['/negocios', slug, 'servicios', service.id]"
                  >
                    Ver detalle y reservar <span aria-hidden="true">→</span>
                  </a>
                  @if (isBusinessAdmin()) {
                    <a
                      class="service-link"
                      [routerLink]="['/panel/servicios', service.id, 'formulario']"
                    >
                      Formulario del servicio ⚙
                    </a>
                  }
                </div>
              </app-card>
            }
          </div>
        }
      }
    </section>
  `,
  styleUrl: './business-detail.scss',
})
export class BusinessDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly businessService = inject(BusinessService);
  private readonly auth = inject(AuthService);
  private readonly followingService = inject(FollowingService);
  protected readonly business = signal<Business | null>(null);
  protected readonly services = signal<BusinessServiceItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly following = signal(false);
  protected readonly followingLoading = signal(false);
  protected slug = '';

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.businessService.getPublic(this.slug).subscribe({
      next: (response) => {
        this.business.set(response.data);
        if (this.isClient()) {
          this.followingService.getState(response.data.id).subscribe({
            next: (state) => this.following.set(state.data.siguiendo),
          });
        }
        this.businessService.listServices(this.slug).subscribe({
          next: (services) => {
            this.services.set(services.data);
            this.loading.set(false);
          },
          error: (error: ApiErrorResponse) => this.showError(error),
        });
      },
      error: (error: ApiErrorResponse) => this.showError(error),
    });
  }

  protected isClient(): boolean {
    return this.auth.currentUser()?.rol === 'cliente';
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

  protected toggleFollowing(): void {
    const activeBusiness = this.business();
    if (!activeBusiness) return;
    this.followingLoading.set(true);
    const request = this.following()
      ? this.followingService.unfollow(activeBusiness.id)
      : this.followingService.follow(activeBusiness.id);
    request.subscribe({
      next: (response) => {
        this.following.set(response.data.siguiendo);
        this.followingLoading.set(false);
      },
      error: (error: ApiErrorResponse) => this.showError(error),
    });
  }

  private showError(error: ApiErrorResponse): void {
    this.errorMessage.set(error.error?.message ?? 'No se pudo cargar la información.');
    this.followingLoading.set(false);
    this.loading.set(false);
  }
}
