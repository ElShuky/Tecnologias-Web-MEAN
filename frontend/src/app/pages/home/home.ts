import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { AuthService } from '../../core/services/auth.service';
import { FollowingService } from '../../core/services/following.service';
import { FollowedBusiness } from '../../core/models/following.model';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { CurrencyPipe } from '@angular/common';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Button, Card, CurrencyPipe, RouterLink, StatusMessage],
  template: `
    <section class="hero">
      <div class="shell hero-grid">
        <div>
          <p class="eyebrow">Agenda tu tiempo</p>
          <h1 class="page-title">Tus reservas, simples y a tu ritmo.</h1>
          <p class="page-lead">
            Encuentra negocios, revisa sus horarios y reserva en pocos pasos desde un solo lugar.
          </p>
          <div class="hero-actions">
            <a routerLink="/negocios"><app-button>Explorar negocios</app-button></a>
            <a routerLink="/login"><app-button variant="ghost">Iniciar sesión</app-button></a>
          </div>
        </div>
        <app-card>
          <div class="hero-card">
            <span class="hero-icon">✓</span>
            <div>
              <strong>Tu agenda en orden</strong>
              <p>Recibe confirmaciones y mantén el control de tus próximas visitas.</p>
            </div>
          </div>
          <div class="hero-line"></div>
          <div class="hero-stat"><strong>+120</strong><span>negocios disponibles</span></div>
        </app-card>
      </div>
    </section>

    <section class="shell features">
      <div class="section-heading">
        <p class="eyebrow">Una experiencia clara</p>
        <h2>Todo lo que necesitas para reservar</h2>
      </div>
      <div class="feature-grid">
        @for (feature of features; track feature.title) {
          <app-card [interactive]="true">
            <span class="feature-number">{{ feature.number }}</span>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </app-card>
        }
      </div>
    </section>

    @if (isClient()) {
      <section class="shell followed-section">
        <div class="section-heading">
          <p class="eyebrow">Tus negocios</p>
          <h2>Servicios de los negocios que sigues</h2>
        </div>
        @if (followLoading()) {
          <app-status-message
            title="Cargando negocios seguidos"
            message="Estamos buscando sus servicios."
          />
        } @else if (followError()) {
          <app-status-message
            type="error"
            title="No se pudo cargar tu selección"
            [message]="followError()"
          />
        } @else if (followedBusinesses().length === 0) {
          <app-status-message
            title="Aún no sigues negocios"
            message="Visita un negocio y pulsa Seguir negocio para tener sus servicios a mano."
          />
        } @else {
          <div class="followed-grid">
            @for (business of followedBusinesses(); track business.id) {
              <app-card>
                <span class="feature-number">{{ business.rubro }}</span>
                <h3>{{ business.nombre }}</h3>
                @for (service of business.servicios; track service.id) {
                  <a
                    class="followed-service"
                    [routerLink]="['/negocios', business.slug, 'servicios', service.id]"
                  >
                    <span>{{ service.nombre }}</span>
                    <strong>{{
                      service.precio | currency: 'CLP' : 'symbol-narrow' : '1.0-0'
                    }}</strong>
                  </a>
                }
                <a class="business-link" [routerLink]="['/negocios', business.slug]">Ver negocio</a>
              </app-card>
            }
          </div>
        }
      </section>
    }
  `,
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly followingService = inject(FollowingService);
  protected readonly followedBusinesses = signal<FollowedBusiness[]>([]);
  protected readonly followLoading = signal(false);
  protected readonly followError = signal('');
  protected readonly features = [
    { number: '01', title: 'Descubre', description: 'Explora negocios y servicios cerca de ti.' },
    { number: '02', title: 'Elige', description: 'Consulta horarios disponibles en tiempo real.' },
    {
      number: '03',
      title: 'Reserva',
      description: 'Confirma tu hora y recibe el detalle de tu reserva.',
    },
  ];

  ngOnInit(): void {
    if (!this.isClient()) return;
    this.followLoading.set(true);
    this.followingService.list().subscribe({
      next: (response) => {
        this.followedBusinesses.set(response.data);
        this.followLoading.set(false);
      },
      error: (error: ApiErrorResponse) => {
        this.followError.set(
          error.error?.message ?? 'No se pudieron cargar los negocios seguidos.',
        );
        this.followLoading.set(false);
      },
    });
  }

  protected isClient(): boolean {
    return this.auth.currentUser()?.rol === 'cliente';
  }
}
