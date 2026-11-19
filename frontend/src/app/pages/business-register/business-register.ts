import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BusinessService } from '../../core/services/business.service';
import { Business, BusinessRubro } from '../../core/models/business.model';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { FormField } from '../../shared/ui/form-field/form-field';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-business-register',
  standalone: true,
  imports: [Button, Card, FormField, ReactiveFormsModule, RouterLink, StatusMessage],
  template: `
    <section class="page shell business-register-page">
      <app-card>
        <p class="eyebrow">Nuevo negocio</p>
        <h1>Registrar negocio</h1>
        <p class="intro">Crea el negocio y su administrador inicial en una sola operación.</p>

        @if (errorMessage()) {
          <app-status-message
            type="error"
            title="No se pudo registrar"
            [message]="errorMessage()"
          />
        }
        @if (createdBusiness(); as business) {
          <app-status-message
            type="success"
            title="Negocio creado correctamente"
            message="Comparte este enlace público con tus clientes."
          />
          <div class="public-link">
            <strong>Enlace público</strong>
            <a [href]="business.enlacePublico" target="_blank" rel="noopener">{{
              business.enlacePublico
            }}</a>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <app-form-field label="Nombre del negocio">
            <input formControlName="nombre" type="text" placeholder="Barbería Central" />
          </app-form-field>
          <app-form-field
            label="Rubro"
            hint="Puedes elegir un rubro existente o escribir uno nuevo."
          >
            <input
              formControlName="rubro"
              type="text"
              list="rubros-sugeridos"
              placeholder="Estética"
            />
          </app-form-field>
          <datalist id="rubros-sugeridos">
            @for (rubro of rubros(); track rubro.clave) {
              <option [value]="rubro.nombre"></option>
            }
          </datalist>
          <app-form-field
            label="Slug"
            hint="Se usará en el enlace público. Ejemplo: barberia-central"
          >
            <input formControlName="slug" type="text" placeholder="barberia-central" />
          </app-form-field>
          <app-form-field label="Descripción">
            <textarea
              formControlName="descripcion"
              rows="3"
              placeholder="Cuéntanos sobre el negocio"
            ></textarea>
          </app-form-field>
          <div class="form-divider">Administrador inicial</div>
          <app-form-field label="Nombre del administrador">
            <input formControlName="adminNombre" type="text" placeholder="Nombre completo" />
          </app-form-field>
          <app-form-field label="Correo del administrador">
            <input formControlName="adminCorreo" type="email" placeholder="admin@negocio.cl" />
          </app-form-field>
          <app-form-field label="Contraseña temporal" hint="Mínimo 8 caracteres.">
            <input formControlName="adminPassword" type="password" placeholder="••••••••" />
          </app-form-field>
          <app-button type="submit">{{
            submitting() ? 'Registrando...' : 'Registrar negocio'
          }}</app-button>
        </form>
        <a class="back-link" routerLink="/panel/superadmin">Volver al panel</a>
      </app-card>
    </section>
  `,
  styleUrl: './business-register.scss',
})
export class BusinessRegister implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly businessService = inject(BusinessService);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly createdBusiness = signal<Business | null>(null);
  protected readonly rubros = signal<BusinessRubro[]>([]);

  protected readonly form = this.formBuilder.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    rubro: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    descripcion: [''],
    adminNombre: ['', [Validators.required, Validators.minLength(2)]],
    adminCorreo: ['', [Validators.required, Validators.email]],
    adminPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.loadRubros();
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

  protected submit(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.businessService.create(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.createdBusiness.set(response.data);
        this.submitting.set(false);
        this.loadRubros();
      },
      error: (error: ApiErrorResponse) => {
        this.errorMessage.set(error.error?.message ?? 'No se pudo registrar el negocio.');
        this.submitting.set(false);
      },
    });
  }
}
