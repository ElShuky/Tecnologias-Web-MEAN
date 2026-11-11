import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { FormField } from '../../shared/ui/form-field/form-field';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [Button, Card, FormField, ReactiveFormsModule, RouterLink, StatusMessage],
  template: `
    <section class="page shell register-page">
      <app-card>
        <p class="eyebrow">Comienza hoy</p>
        <h1>Crear cuenta</h1>
        <p class="intro">Regístrate como cliente para reservar tus próximas visitas.</p>

        @if (errorMessage()) {
          <app-status-message
            type="error"
            title="No pudimos crear tu cuenta"
            [message]="errorMessage()"
          />
        }
        @if (registered()) {
          <app-status-message
            type="success"
            title="Cuenta creada"
            message="Tu registro fue exitoso. Ahora puedes iniciar sesión."
          />
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <app-form-field label="Nombre completo">
            <input
              formControlName="nombre"
              type="text"
              placeholder="Tu nombre"
              autocomplete="name"
            />
            @if (form.controls.nombre.touched && form.controls.nombre.invalid) {
              <small class="field-error">El nombre debe tener al menos 2 caracteres.</small>
            }
          </app-form-field>
          <app-form-field label="Correo electrónico">
            <input
              formControlName="correo"
              type="email"
              placeholder="tu@correo.cl"
              autocomplete="email"
            />
            @if (form.controls.correo.touched && form.controls.correo.invalid) {
              <small class="field-error">Ingresa un correo electrónico válido.</small>
            }
          </app-form-field>
          <app-form-field label="Contraseña" hint="Mínimo 8 caracteres.">
            <input
              formControlName="password"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <small class="field-error">La contraseña debe tener al menos 8 caracteres.</small>
            }
          </app-form-field>
          <app-button type="submit">{{
            submitting() ? 'Creando cuenta...' : 'Registrarme'
          }}</app-button>
        </form>
        <p class="switch-link">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
      </app-card>
    </section>
  `,
  styleUrl: './register.scss',
})
export class Register {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly submitting = signal(false);
  protected readonly registered = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.formBuilder.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    this.errorMessage.set('');
    this.registered.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.registered.set(true);
        setTimeout(() => void this.router.navigate(['/login']), 900);
      },
      error: (error: ApiErrorResponse) => {
        this.errorMessage.set(error.error?.message ?? 'No fue posible completar el registro.');
        this.submitting.set(false);
      },
    });
  }
}
