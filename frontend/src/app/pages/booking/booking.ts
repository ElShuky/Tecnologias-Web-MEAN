import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import {
  BlocksData,
  BookingAnswerInput,
  CreateBookingRequest,
  TimeBlock,
} from '../../core/models/booking.model';
import { Business } from '../../core/models/business.model';
import { BusinessServiceItem, ServiceFormField } from '../../core/models/service.model';
import { BookingService } from '../../core/services/booking.service';
import { BusinessService } from '../../core/services/business.service';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { FormField } from '../../shared/ui/form-field/form-field';
import { StatusMessage } from '../../shared/ui/status-message/status-message';
import { DateLabelPipe } from '../../shared/pipes/date-label.pipe';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [
    Button,
    Card,
    CurrencyPipe,
    DateLabelPipe,
    FormField,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    StatusMessage,
  ],
  template: `
    <section
      class="page shell booking-page"
      [style.--primary]="primaryColor()"
      [style.--secondary]="secondaryColor()"
    >
      <a class="back-link" [routerLink]="['/negocios', slug]">← Volver a los servicios</a>
      <p class="eyebrow">Nueva reserva</p>
      <h1 class="page-title">Elige tu horario</h1>
      <p class="page-lead">
        Selecciona una fecha y un bloque disponible para confirmar tu atención.
      </p>

      @if (loadingDetails()) {
        <app-status-message
          title="Cargando reserva"
          message="Estamos preparando el negocio y servicio."
        />
      } @else if (detailsError()) {
        <app-status-message
          type="error"
          title="No se pudo cargar la reserva"
          [message]="detailsError()"
        />
      } @else if (business(); as activeBusiness) {
        @if (service(); as activeService) {
          <div class="booking-layout">
            <div class="booking-selection">
              <app-card>
                <div class="summary-heading">
                  <div>
                    <p class="eyebrow">Disponibilidad</p>
                    <h2>{{ activeService.nombre }}</h2>
                    <span>{{ activeBusiness.nombre }}</span>
                  </div>
                  <strong>{{
                    activeService.precio | currency: 'CLP' : 'symbol-narrow' : '1.0-0'
                  }}</strong>
                </div>

                <app-form-field label="Fecha">
                  <input
                    [(ngModel)]="selectedDate"
                    (ngModelChange)="loadBlocks()"
                    name="date"
                    type="date"
                    [min]="today"
                  />
                </app-form-field>

                @if (blocksLoading()) {
                  <app-status-message
                    title="Cargando horarios"
                    message="Consultando disponibilidad."
                  />
                } @else if (blocksError()) {
                  <app-status-message
                    type="error"
                    title="No se pudo consultar la agenda"
                    [message]="blocksError()"
                  />
                } @else if (blocks().length === 0) {
                  <app-status-message
                    title="No hay horarios disponibles"
                    message="Este servicio no tiene jornada configurada para la fecha seleccionada."
                  />
                } @else {
                  <div class="blocks-heading">
                    <h3>Bloques horarios</h3>
                    <span>Los bloques ocupados no se pueden seleccionar.</span>
                  </div>
                  <div class="blocks-grid">
                    @for (block of blocks(); track block.hora) {
                      <button
                        class="time-block"
                        [class.is-selected]="selectedBlock()?.hora === block.hora"
                        [class.is-occupied]="block.ocupado"
                        [disabled]="!block.seleccionable"
                        type="button"
                        (click)="selectBlock(block)"
                      >
                        <strong>{{ block.hora }}</strong>
                        <span>{{ block.horaFin }}</span>
                        @if (block.ocupado) {
                          <small>Ocupado</small>
                        } @else if (selectedBlock()?.hora === block.hora) {
                          <small>Seleccionado</small>
                        } @else {
                          <small>Disponible</small>
                        }
                      </button>
                    }
                  </div>
                }

                @if (formFields().length > 0) {
                  <div class="custom-booking-form" [formGroup]="customForm">
                    <div class="blocks-heading">
                      <h3>Datos adicionales del servicio</h3>
                      <span>
                        Completa la información solicitada para
                        <strong>{{ activeService.nombre }}</strong
                        >.
                      </span>
                    </div>

                    @for (campo of formFields(); track campo.id) {
                      <div
                        class="custom-field-group"
                        [class.has-error]="!!getFieldErrorMessage(campo.id!)"
                      >
                        <div class="custom-field-label">
                          <div class="field-title-row">
                            <span class="field-label-text">{{ campo.etiqueta }}</span>
                            @if (campo.obligatorio) {
                              <span class="req-badge" aria-label="Obligatorio">
                                * Obligatorio
                              </span>
                            } @else {
                              <span class="opt-badge">Opcional</span>
                            }
                          </div>
                          @if (campo.textoAyuda) {
                            <small class="custom-field-hint">{{ campo.textoAyuda }}</small>
                          }
                        </div>

                        @switch (campo.tipo) {
                          @case ('texto_corto') {
                            <input
                              type="text"
                              [formControlName]="campo.id!"
                              placeholder="Ingresa tu respuesta (máximo 200 caracteres)"
                              (input)="clearServerFieldError(campo.id!)"
                            />
                          }
                          @case ('texto_largo') {
                            <textarea
                              rows="3"
                              [formControlName]="campo.id!"
                              placeholder="Ingresa tu respuesta (máximo 1000 caracteres)"
                              (input)="clearServerFieldError(campo.id!)"
                            ></textarea>
                          }
                          @case ('numero') {
                            <input
                              type="number"
                              [formControlName]="campo.id!"
                              placeholder="Ingresa un valor numérico"
                              (input)="clearServerFieldError(campo.id!)"
                            />
                          }
                          @case ('fecha') {
                            <input
                              type="date"
                              [formControlName]="campo.id!"
                              (change)="clearServerFieldError(campo.id!)"
                            />
                          }
                          @case ('si_no') {
                            <div
                              class="switch-control"
                              role="group"
                              [attr.aria-label]="campo.etiqueta"
                            >
                              <label class="switch-toggle">
                                <input
                                  type="checkbox"
                                  role="switch"
                                  [checked]="getControl(campo.id!)?.value === true"
                                  (change)="onSwitchToggle(campo.id!, $event)"
                                />
                                <span class="switch-slider"></span>
                              </label>
                              <div class="switch-buttons">
                                <button
                                  type="button"
                                  class="switch-option"
                                  [class.is-active]="getControl(campo.id!)?.value === true"
                                  (click)="setBooleanValue(campo.id!, true)"
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  class="switch-option"
                                  [class.is-active]="getControl(campo.id!)?.value === false"
                                  (click)="setBooleanValue(campo.id!, false)"
                                >
                                  No
                                </button>
                              </div>
                              <span class="switch-state-label">
                                {{
                                  getControl(campo.id!)?.value === true
                                    ? 'Sí'
                                    : getControl(campo.id!)?.value === false
                                      ? 'No'
                                      : 'Sin responder'
                                }}
                              </span>
                            </div>
                          }
                          @case ('seleccion_unica') {
                            <select
                              [formControlName]="campo.id!"
                              (change)="clearServerFieldError(campo.id!)"
                            >
                              <option value="">Selecciona una opción</option>
                              @for (opt of campo.opciones || []; track opt) {
                                <option [value]="opt">{{ opt }}</option>
                              }
                            </select>
                          }
                          @case ('seleccion_multiple') {
                            <div class="multi-options-group">
                              @for (opt of campo.opciones || []; track opt) {
                                <label class="multi-option-item">
                                  <input
                                    type="checkbox"
                                    [checked]="isMultiOptionSelected(campo.id!, opt)"
                                    (change)="toggleMultiOption(campo.id!, opt, $event)"
                                  />
                                  <span>{{ opt }}</span>
                                </label>
                              }
                            </div>
                          }
                        }

                        @if (getFieldErrorMessage(campo.id!); as errorMsg) {
                          <small class="field-error-message" role="alert">{{ errorMsg }}</small>
                        }
                      </div>
                    }
                  </div>
                }

                <app-form-field label="Notas (opcional)" hint="Máximo 500 caracteres.">
                  <textarea
                    [(ngModel)]="notes"
                    name="notes"
                    rows="4"
                    maxlength="500"
                    placeholder="Agrega alguna indicación para el negocio"
                  ></textarea>
                </app-form-field>
              </app-card>
            </div>

            <aside class="booking-summary">
              <app-card>
                <p class="eyebrow">Resumen</p>
                <h2>{{ activeBusiness.nombre }}</h2>
                <dl>
                  <div>
                    <dt>Servicio</dt>
                    <dd>{{ activeService.nombre }}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{{ selectedDate | dateLabel }}</dd>
                  </div>
                  <div>
                    <dt>Hora</dt>
                    <dd>{{ selectedBlock()?.hora || 'Selecciona un bloque' }}</dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>{{ activeService.duracionMin }} minutos</dd>
                  </div>
                  <div>
                    <dt>Precio</dt>
                    <dd>
                      {{ activeService.precio | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}
                    </dd>
                  </div>
                </dl>
                @if (conflictMessage()) {
                  <app-status-message
                    type="warning"
                    title="Revisa tu reserva"
                    [message]="conflictMessage()"
                  />
                }
                @if (successMessage()) {
                  <app-status-message
                    type="success"
                    title="Reserva confirmada"
                    [message]="successMessage()"
                  />
                }
                <div class="summary-actions">
                  <app-button
                    [disabled]="!selectedBlock() || submitting() || !isCustomFormValid()"
                    (click)="confirmBooking()"
                  >
                    {{ submitting() ? 'Confirmando...' : 'Confirmar reserva' }}
                  </app-button>
                  <a class="cancel-link" [routerLink]="['/negocios', slug, 'servicios', serviceId]">
                    Cancelar
                  </a>
                </div>
              </app-card>
            </aside>
          </div>
        }
      }
    </section>
  `,
  styleUrl: './booking.scss',
})
export class Booking implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly businessService = inject(BusinessService);
  private readonly bookingService = inject(BookingService);

  protected readonly business = signal<Business | null>(null);
  protected readonly service = signal<BusinessServiceItem | null>(null);
  protected readonly formFields = signal<ServiceFormField[]>([]);
  protected readonly serverFieldErrors = signal<Record<string, string>>({});
  protected readonly formSubmitted = signal(false);
  protected readonly blocks = signal<TimeBlock[]>([]);
  protected readonly selectedBlock = signal<TimeBlock | null>(null);
  protected readonly loadingDetails = signal(true);
  protected readonly blocksLoading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly detailsError = signal('');
  protected readonly blocksError = signal('');
  protected readonly conflictMessage = signal('');
  protected readonly successMessage = signal('');

  protected customForm = new FormGroup<Record<string, FormControl<unknown>>>({});
  protected slug = '';
  protected serviceId = '';
  protected selectedDate = this.formatDate(new Date());
  protected notes = '';
  protected today = this.selectedDate;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.slug = params.get('slug') ?? '';
      this.serviceId = params.get('serviceId') ?? '';
      if (!this.slug || !this.serviceId) {
        this.detailsError.set('Faltan datos del negocio o servicio para crear la reserva.');
        this.loadingDetails.set(false);
        return;
      }
      this.loadServiceAndForm();
    });
  }

  protected loadServiceAndForm(): void {
    this.loadingDetails.set(true);
    this.detailsError.set('');
    this.conflictMessage.set('');
    this.successMessage.set('');

    forkJoin({
      business: this.businessService.getPublic(this.slug),
      service: this.businessService.getService(this.slug, this.serviceId),
      form: this.businessService
        .getServiceForm(this.serviceId)
        .pipe(
          catchError(() => of({ success: true, data: { servicioId: this.serviceId, campos: [] } })),
        ),
    }).subscribe({
      next: (response) => {
        this.business.set(response.business.data);
        this.service.set(response.service.data);
        const activeFields = (response.form.data.campos ?? []).filter(
          (campo) => campo.activo !== false,
        );
        this.formFields.set(activeFields);
        this.buildReactiveForm(activeFields);
        this.loadingDetails.set(false);
        this.loadBlocks();
      },
      error: (error: ApiErrorResponse) => {
        this.detailsError.set(error.error?.message ?? 'No se pudo cargar la reserva.');
        this.loadingDetails.set(false);
      },
    });
  }

  protected buildReactiveForm(campos: ServiceFormField[]): void {
    const group: Record<string, FormControl<unknown>> = {};
    for (const campo of campos) {
      if (!campo.id) continue;
      let initialValue: unknown = '';
      if (campo.tipo === 'numero' || campo.tipo === 'si_no') {
        initialValue = null;
      } else if (campo.tipo === 'seleccion_multiple') {
        initialValue = [];
      }
      group[campo.id] = new FormControl<unknown>(initialValue, [this.createFieldValidator(campo)]);
    }
    this.customForm = new FormGroup(group);
    this.serverFieldErrors.set({});
    this.formSubmitted.set(false);
  }

  protected createFieldValidator(campo: ServiceFormField): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const val = control.value;
      const isEmpty =
        val === null ||
        val === undefined ||
        (typeof val === 'string' && val.trim() === '') ||
        (Array.isArray(val) && val.length === 0);

      if (isEmpty) {
        return campo.obligatorio
          ? { required: `El campo "${campo.etiqueta}" es obligatorio.` }
          : null;
      }

      switch (campo.tipo) {
        case 'texto_corto': {
          if (typeof val !== 'string') {
            return { invalidType: 'Debe ingresar un texto válido.' };
          }
          if (val.length > 200 || val.trim().length > 200) {
            return {
              maxlength: 'El texto corto no puede superar los 200 caracteres.',
            };
          }
          return null;
        }
        case 'texto_largo': {
          if (typeof val !== 'string') {
            return { invalidType: 'Debe ingresar un texto válido.' };
          }
          if (val.length > 1000 || val.trim().length > 1000) {
            return {
              maxlength: 'El texto largo no puede superar los 1000 caracteres.',
            };
          }
          return null;
        }
        case 'numero': {
          const parsed = typeof val === 'number' ? val : Number(val);
          if (typeof val === 'boolean' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
            return { invalidType: 'Debe ingresar un número válido.' };
          }
          return null;
        }
        case 'fecha': {
          if (typeof val !== 'string' || !this.isValidCalendarDate(val.trim())) {
            return { invalidDate: 'Debe ingresar una fecha válida (AAAA-MM-DD).' };
          }
          return null;
        }
        case 'si_no': {
          if (typeof val !== 'boolean') {
            return { invalidBoolean: 'Debe seleccionar Sí o No.' };
          }
          return null;
        }
        case 'seleccion_unica': {
          const allowed = campo.opciones ?? [];
          if (typeof val !== 'string' || !allowed.includes(val.trim())) {
            return { invalidOption: 'Debe elegir una de las opciones permitidas.' };
          }
          return null;
        }
        case 'seleccion_multiple': {
          const allowed = campo.opciones ?? [];
          if (
            !Array.isArray(val) ||
            val.length === 0 ||
            val.some((item) => typeof item !== 'string' || !allowed.includes(item.trim()))
          ) {
            return { invalidOption: 'Debe elegir opciones permitidas de la lista.' };
          }
          const clean = val.map((item) => item.trim());
          if (new Set(clean).size !== clean.length) {
            return { duplicateOption: 'No se pueden repetir opciones.' };
          }
          return null;
        }
        default:
          return null;
      }
    };
  }

  protected getControl(campoId: string): FormControl<unknown> | null {
    return (this.customForm.get(campoId) as FormControl<unknown>) ?? null;
  }

  protected isCustomFormValid(): boolean {
    return this.customForm.valid;
  }

  protected getFieldErrorMessage(campoId: string): string {
    const serverErr = this.serverFieldErrors()[campoId];
    if (serverErr) {
      return serverErr;
    }
    const control = this.getControl(campoId);
    if (!control || !control.errors) {
      return '';
    }
    if (!control.touched && !control.dirty && !this.formSubmitted()) {
      return '';
    }
    const firstKey = Object.keys(control.errors)[0];
    const errVal = control.errors[firstKey];
    return typeof errVal === 'string' ? errVal : 'Este campo contiene un valor inválido.';
  }

  protected clearServerFieldError(campoId: string): void {
    if (this.serverFieldErrors()[campoId]) {
      this.serverFieldErrors.update((curr) => {
        const copy = { ...curr };
        delete copy[campoId];
        return copy;
      });
    }
  }

  protected onSwitchToggle(campoId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.setBooleanValue(campoId, checked);
  }

  protected setBooleanValue(campoId: string, value: boolean): void {
    const control = this.getControl(campoId);
    if (!control) return;
    this.clearServerFieldError(campoId);
    control.setValue(value);
    control.markAsTouched();
    control.markAsDirty();
  }

  protected isMultiOptionSelected(campoId: string, option: string): boolean {
    const val = this.getControl(campoId)?.value;
    return Array.isArray(val) && val.includes(option);
  }

  protected toggleMultiOption(campoId: string, option: string, event: Event): void {
    const control = this.getControl(campoId);
    if (!control) return;
    this.clearServerFieldError(campoId);
    const checked = (event.target as HTMLInputElement).checked;
    const existing = Array.isArray(control.value) ? (control.value as string[]) : [];
    const updated = checked
      ? [...new Set([...existing, option])]
      : existing.filter((item) => item !== option);
    control.setValue(updated);
    control.markAsTouched();
    control.markAsDirty();
  }

  protected loadBlocks(clearMessages = true): void {
    this.selectedBlock.set(null);
    if (clearMessages) {
      this.conflictMessage.set('');
      this.successMessage.set('');
    }
    if (!this.slug || !this.serviceId || !this.selectedDate) return;
    this.blocksLoading.set(true);
    this.blocksError.set('');
    this.bookingService.getBlocks(this.slug, this.serviceId, this.selectedDate).subscribe({
      next: (response: { data: BlocksData }) => {
        this.blocks.set(response.data.bloques);
        this.blocksLoading.set(false);
      },
      error: (error: ApiErrorResponse) => {
        this.blocksError.set(error.error?.message ?? 'No se pudo consultar la disponibilidad.');
        this.blocksLoading.set(false);
      },
    });
  }

  protected selectBlock(block: TimeBlock): void {
    if (block.seleccionable) {
      this.selectedBlock.set(block);
      this.conflictMessage.set('');
    }
  }

  protected confirmBooking(): void {
    const activeBusiness = this.business();
    const activeService = this.service();
    const block = this.selectedBlock();
    if (!activeBusiness || !activeService || !block) return;

    this.formSubmitted.set(true);
    this.customForm.markAllAsTouched();
    this.customForm.updateValueAndValidity();

    if (this.customForm.invalid) {
      this.conflictMessage.set(
        'Completa correctamente los campos obligatorios antes de confirmar la reserva.',
      );
      return;
    }

    const respuestas: BookingAnswerInput[] = [];
    for (const campo of this.formFields()) {
      if (!campo.id) continue;
      const rawVal = this.getControl(campo.id)?.value;
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;
      if (Array.isArray(rawVal) && rawVal.length === 0) continue;

      if (campo.tipo === 'numero') {
        respuestas.push({ campoId: campo.id, valor: Number(rawVal) });
      } else if (typeof rawVal === 'string') {
        respuestas.push({ campoId: campo.id, valor: rawVal.trim() });
      } else {
        respuestas.push({
          campoId: campo.id,
          valor: rawVal as boolean | string[],
        });
      }
    }

    const request: CreateBookingRequest = {
      negocioId: activeBusiness.id,
      servicioId: activeService.id,
      fecha: this.selectedDate,
      hora: block.hora,
      notas: this.notes.trim(),
      ...(this.formFields().length > 0 ? { respuestas } : {}),
    };
    this.submitting.set(true);
    this.conflictMessage.set('');
    this.successMessage.set('');
    this.serverFieldErrors.set({});

    this.bookingService.create(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.successMessage.set('Tu hora quedó confirmada. Puedes verla en Mis reservas.');
        this.selectedBlock.set(null);
        this.notes = '';
        this.buildReactiveForm(this.formFields());
        this.loadBlocks(false);
      },
      error: (error: ApiErrorResponse) => {
        this.submitting.set(false);
        if (error.error?.code === 'CONFLICT' || error.error?.code === 'DUPLICATE_KEY_ERROR') {
          // Conserva todo lo ingresado en customForm y notes para que el cliente solo elija otro horario
          this.conflictMessage.set(
            'Selecciona otro horario; alguien más reservó este bloque antes que tú.',
          );
          this.loadBlocks(false);
          return;
        }

        const details = error.error?.details ?? [];
        const fieldErrorsMap: Record<string, string> = {};
        for (const detail of details) {
          const fieldKey = detail.field;
          if (fieldKey && this.getControl(fieldKey)) {
            fieldErrorsMap[fieldKey] = detail.message;
            this.getControl(fieldKey)?.markAsTouched();
          }
        }
        if (Object.keys(fieldErrorsMap).length > 0) {
          this.serverFieldErrors.set(fieldErrorsMap);
        }

        const detailMsg = details[0]?.message;
        this.conflictMessage.set(
          detailMsg || error.error?.message || 'No se pudo confirmar la reserva.',
        );
      },
    });
  }

  private isValidCalendarDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  protected primaryColor(): string {
    return this.business()?.personalizacion?.colorPrimario || '#2F6F78';
  }

  protected secondaryColor(): string {
    return this.business()?.personalizacion?.colorSecundario || '#B77942';
  }
}
