import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { FormField } from '../../shared/ui/form-field/form-field';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [Button, Card, FormField, ReactiveFormsModule, RouterLink, StatusMessage],
  template: `
    <section class="page shell login-page">
      <app-card>
        <p class="eyebrow">Bienvenido</p>
        <h1>Iniciar sesión</h1>
        <p class="intro">Accede para administrar tus reservas.</p>

        @if (errorMessage()) {
          <app-status-message
            type="error"
            title="No pudimos iniciar sesión"
            [message]="errorMessage()"
          />
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
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
          <app-form-field label="Contraseña">
            <input
              formControlName="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <small class="field-error">La contraseña es obligatoria.</small>
            }
          </app-form-field>
          <app-button type="submit">{{ submitting() ? 'Ingresando...' : 'Ingresar' }}</app-button>
        </form>
        <p class="switch-link">¿Aún no tienes cuenta? <a routerLink="/registro">Regístrate</a></p>
      </app-card>
    </section>
  `,
  styleUrl: './login.scss',
})
export class Login {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.formBuilder.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected submit(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => this.auth.redirectByRole(response.data.usuario.rol),
      error: (error: ApiErrorResponse) => {
        this.errorMessage.set(
          error.error?.message ?? 'Revisa tus credenciales e inténtalo nuevamente.',
        );
        this.submitting.set(false);
      },
    });
  }
}
