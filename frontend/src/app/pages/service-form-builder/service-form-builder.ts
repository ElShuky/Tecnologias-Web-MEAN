import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiErrorResponse } from '../../core/models/api-response.model';
import { Business } from '../../core/models/business.model';
import {
  BusinessServiceItem,
  ServiceFormField,
  ServiceFormFieldType,
} from '../../core/models/service.model';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService } from '../../core/services/business.service';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

interface DraftField {
  etiqueta: string;
  tipo: ServiceFormFieldType;
  obligatorio: boolean;
  textoAyuda: string;
  opcionesTexto: string;
  activo: boolean;
}

@Component({
  selector: 'app-service-form-builder',
  standalone: true,
  imports: [Button, Card, CurrencyPipe, FormsModule, RouterLink, StatusMessage],
  template: `
    <section
      class="page shell form-builder-page"
      [style.--primary]="primaryColor()"
      [style.--secondary]="secondaryColor()"
      [style.--business-primary]="primaryColor()"
      [style.--business-secondary]="secondaryColor()"
    >
      <a class="back-link" routerLink="/panel/admin">← Volver al panel del negocio</a>
      <p class="eyebrow">Configuración de atención</p>
      <h1 class="page-title">Formulario del servicio</h1>
      <p class="page-lead">
        Define y ordena los campos que el cliente deberá responder al reservar este servicio.
      </p>

      @if (loading()) {
        <app-status-message
          title="Cargando formulario"
          message="Estamos preparando la configuración del servicio."
        />
      } @else if (loadError()) {
        <app-status-message
          type="error"
          title="No se pudo cargar el formulario"
          [message]="loadError()"
        />
      } @else if (activeService(); as currentService) {
        <app-card>
          <div class="service-Selector-bar">
            <div class="service-selector-info">
              <span class="badge-rubro">{{ business()?.nombre || 'Mi negocio' }}</span>
              <h2>{{ currentService.nombre }}</h2>
              <p>
                {{ currentService.duracionMin }} min ·
                {{ currentService.precio | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }} ·
                <strong>{{ fields().length }} / 15 campos configurados</strong>
              </p>
            </div>

            @if (services().length > 1) {
              <label class="service-switcher">
                <span>Cambiar de servicio</span>
                <select [ngModel]="currentService.id" (ngModelChange)="switchService($event)">
                  @for (srv of services(); track srv.id) {
                    <option [value]="srv.id">{{ srv.nombre }}</option>
                  }
                </select>
              </label>
            }
          </div>
        </app-card>

        @if (validationError()) {
          <app-status-message
            type="error"
            title="Revisa los datos del formulario"
            [message]="validationError()"
          />
        }

        @if (successMessage()) {
          <app-status-message
            type="success"
            title="Cambios guardados"
            [message]="successMessage()"
          />
        }

        <div class="builder-workspace">
          <div class="builder-column">
            <app-card>
              <div class="section-header">
                <div>
                  <strong>
                    {{
                      editingIndex() !== null
                        ? 'Editar campo #' + (editingIndex()! + 1)
                        : 'Agregar nuevo campo'
                    }}
                  </strong>
                  <span>
                    Elige la etiqueta, el tipo de dato requerido, si es obligatorio, ayuda opcional
                    y opciones.
                  </span>
                </div>
                <span class="counter-pill">{{ fields().length }} / 15</span>
              </div>

              <div class="draft-form-grid">
                <label class="field-control">
                  <span>Etiqueta del campo *</span>
                  <input
                    type="text"
                    [(ngModel)]="draft.etiqueta"
                    placeholder="Ej. Estilo de corte, Alergias, Largo deseado"
                  />
                </label>

                <label class="field-control">
                  <span>Tipo de dato requerido *</span>
                  <select [(ngModel)]="draft.tipo">
                    @for (opt of fieldTypeOptions; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </label>

                <label class="field-control full-width">
                  <span>Texto de ayuda (opcional)</span>
                  <input
                    type="text"
                    [(ngModel)]="draft.textoAyuda"
                    placeholder="Instrucción o ejemplo visible para orientar al cliente"
                  />
                </label>

                @if (draft.tipo === 'seleccion_unica' || draft.tipo === 'seleccion_multiple') {
                  <label class="field-control full-width">
                    <span>Opciones de selección * (separadas por coma, mínimo 2 sin repetir)</span>
                    <input
                      type="text"
                      [(ngModel)]="draft.opcionesTexto"
                      placeholder="Ej. Opción 1, Opción 2, Opción 3"
                    />
                  </label>
                }
              </div>

              <div class="draft-flags">
                <label class="checkbox-control">
                  <input type="checkbox" [(ngModel)]="draft.obligatorio" />
                  <span>Es obligatorio para reservar</span>
                </label>
                <label class="checkbox-control">
                  <input type="checkbox" [(ngModel)]="draft.activo" />
                  <span>Campo activo (visible para el cliente)</span>
                </label>
              </div>

              <div class="draft-actions">
                <app-button
                  type="button"
                  [disabled]="editingIndex() === null && fields().length >= 15"
                  (click)="applyDraftField()"
                >
                  {{ editingIndex() !== null ? 'Actualizar campo' : 'Agregar campo al listado' }}
                </app-button>
                @if (editingIndex() !== null) {
                  <app-button type="button" variant="ghost" (click)="cancelEditField()">
                    Cancelar edición
                  </app-button>
                }
              </div>
            </app-card>

            <app-card>
              <div class="section-header">
                <div>
                  <strong>Campos del formulario ({{ fields().length }})</strong>
                  <span>
                    Reordena, edita, activa/desactiva o elimina campos antes de guardar el
                    formulario.
                  </span>
                </div>
                @if (fields().length > 0) {
                  <button type="button" class="outline-btn danger" (click)="clearAllFields()">
                    Vaciar todo
                  </button>
                }
              </div>

              @if (fields().length === 0) {
                <p class="empty-hint">
                  Este servicio no tiene campos adicionales configurados. Puedes guardar el
                  formulario vacío o agregar campos arriba.
                </p>
              } @else {
                <div class="configured-fields-list">
                  @for (campo of fields(); track campo.id || campo.etiqueta; let i = $index) {
                    <div
                      class="configured-field-row"
                      [class.is-inactive]="campo.activo === false"
                      [class.is-editing]="editingIndex() === i"
                    >
                      <div class="configured-field-main">
                        <div class="configured-field-title">
                          <span class="order-badge">#{{ i + 1 }}</span>
                          <strong>{{ campo.etiqueta }}</strong>
                          <span class="type-pill">{{ typeLabel(campo.tipo) }}</span>
                          @if (campo.obligatorio) {
                            <span class="req-pill">Obligatorio</span>
                          } @else {
                            <span class="opt-pill">Opcional</span>
                          }
                          @if (campo.activo === false) {
                            <span class="inactive-pill">Inactivo</span>
                          }
                        </div>

                        @if (campo.textoAyuda) {
                          <small class="help-line">Ayuda: {{ campo.textoAyuda }}</small>
                        }

                        @if (campo.opciones && campo.opciones.length > 0) {
                          <div class="options-chips">
                            @for (opt of campo.opciones; track opt) {
                              <span class="option-chip">{{ opt }}</span>
                            }
                          </div>
                        }
                      </div>

                      <div class="configured-field-actions">
                        <button
                          type="button"
                          class="action-btn"
                          [disabled]="i === 0"
                          title="Subir campo"
                          (click)="moveField(i, -1)"
                        >
                          ↑ Subir
                        </button>
                        <button
                          type="button"
                          class="action-btn"
                          [disabled]="i === fields().length - 1"
                          title="Bajar campo"
                          (click)="moveField(i, 1)"
                        >
                          ↓ Bajar
                        </button>
                        <button type="button" class="action-btn" (click)="startEditField(i)">
                          Editar
                        </button>
                        <button type="button" class="action-btn" (click)="toggleFieldActive(i)">
                          {{ campo.activo === false ? 'Activar' : 'Desactivar' }}
                        </button>
                        <button type="button" class="action-btn danger" (click)="removeField(i)">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }

              <div class="save-bar">
                <app-button type="button" [disabled]="saving()" (click)="saveFormToServer()">
                  {{ saving() ? 'Guardando en el servidor...' : 'Guardar formulario del servicio' }}
                </app-button>
              </div>
            </app-card>
          </div>

          <aside class="preview-column">
            <app-card>
              <div class="preview-header">
                <p class="eyebrow">Simulación en tiempo real</p>
                <h3>Vista previa del cliente</h3>
                <span>
                  Así verá el cliente el formulario al reservar
                  <strong>{{ currentService.nombre }}</strong>
                  (solo se muestran los campos activos: {{ activePreviewFields().length }}).
                </span>
              </div>

              @if (activePreviewFields().length === 0) {
                <div class="preview-empty">
                  <strong>Sin datos adicionales requeridos</strong>
                  <p>
                    El cliente podrá confirmar su reserva seleccionando únicamente fecha y bloque
                    horario.
                  </p>
                </div>
              } @else {
                <div class="preview-fields">
                  @for (campo of activePreviewFields(); track campo.id || campo.etiqueta) {
                    <div class="preview-field-item">
                      <div class="preview-field-label">
                        <span>
                          {{ campo.etiqueta }}
                          @if (campo.obligatorio) {
                            <strong class="req-star">*</strong>
                          }
                        </span>
                        <small class="preview-type-tag">{{ typeLabel(campo.tipo) }}</small>
                      </div>

                      @if (campo.textoAyuda) {
                        <small class="preview-help">{{ campo.textoAyuda }}</small>
                      }

                      @switch (campo.tipo) {
                        @case ('texto_corto') {
                          <input
                            type="text"
                            maxlength="200"
                            placeholder="Respuesta de texto corto (máx. 200 caracteres)"
                          />
                        }
                        @case ('texto_largo') {
                          <textarea
                            rows="3"
                            maxlength="1000"
                            placeholder="Respuesta de texto largo (máx. 1000 caracteres)"
                          ></textarea>
                        }
                        @case ('numero') {
                          <input type="number" placeholder="Ej. 1" />
                        }
                        @case ('fecha') {
                          <input type="date" />
                        }
                        @case ('si_no') {
                          <select>
                            <option value="">Selecciona Sí o No</option>
                            <option value="true">Sí</option>
                            <option value="false">No</option>
                          </select>
                        }
                        @case ('seleccion_unica') {
                          <select>
                            <option value="">Selecciona una opción</option>
                            @for (opt of campo.opciones || []; track opt) {
                              <option [value]="opt">{{ opt }}</option>
                            }
                          </select>
                        }
                        @case ('seleccion_multiple') {
                          <div class="preview-multi-options">
                            @for (opt of campo.opciones || []; track opt) {
                              <label class="preview-checkbox">
                                <input type="checkbox" />
                                <span>{{ opt }}</span>
                              </label>
                            }
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              }
            </app-card>
          </aside>
        </div>
      }
    </section>
  `,
  styleUrl: './service-form-builder.scss',
})
export class ServiceFormBuilder implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly businessService = inject(BusinessService);

  protected readonly business = signal<Business | null>(null);
  protected readonly services = signal<BusinessServiceItem[]>([]);
  protected readonly activeService = signal<BusinessServiceItem | null>(null);
  protected readonly fields = signal<ServiceFormField[]>([]);
  protected readonly editingIndex = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal('');
  protected readonly validationError = signal('');
  protected readonly successMessage = signal('');

  protected draft: DraftField = this.emptyDraft();

  protected readonly fieldTypeOptions: { value: ServiceFormFieldType; label: string }[] = [
    { value: 'texto_corto', label: 'Texto corto' },
    { value: 'texto_largo', label: 'Texto largo' },
    { value: 'numero', label: 'Número' },
    { value: 'fecha', label: 'Fecha' },
    { value: 'si_no', label: 'Sí / No' },
    { value: 'seleccion_unica', label: 'Selección única' },
    { value: 'seleccion_multiple', label: 'Selección múltiple' },
  ];

  private readonly typeLabelsMap: Record<ServiceFormFieldType, string> = {
    texto_corto: 'Texto corto',
    texto_largo: 'Texto largo',
    numero: 'Número',
    fecha: 'Fecha',
    si_no: 'Sí / No',
    seleccion_unica: 'Selección única',
    seleccion_multiple: 'Selección múltiple',
  };

  protected readonly activePreviewFields = computed(() =>
    this.fields().filter((campo) => campo.activo !== false),
  );

  ngOnInit(): void {
    const businessId = this.auth.currentUser()?.negocioId;
    if (!businessId) {
      this.loadError.set('Tu cuenta de administrador no tiene un negocio asociado.');
      this.loading.set(false);
      return;
    }

    this.businessService.getForManagement(businessId).subscribe({
      next: (bizRes) => {
        this.business.set(bizRes.data);
        this.businessService.listManagedServices(businessId).subscribe({
          next: (srvRes) => {
            this.services.set(srvRes.data);
            this.route.paramMap.subscribe((params) => {
              const serviceId = params.get('serviceId') ?? '';
              const found = srvRes.data.find((item) => item.id === serviceId) ?? srvRes.data[0];
              if (!found) {
                this.loadError.set('El servicio solicitado no pertenece a tu negocio.');
                this.loading.set(false);
                return;
              }
              this.loadServiceForm(found);
            });
          },
          error: (error: ApiErrorResponse) => {
            this.loadError.set(
              error.error?.message ?? 'No se pudieron cargar los servicios del negocio.',
            );
            this.loading.set(false);
          },
        });
      },
      error: (error: ApiErrorResponse) => {
        this.loadError.set(error.error?.message ?? 'No se pudo cargar la información del negocio.');
        this.loading.set(false);
      },
    });
  }

  protected switchService(serviceId: string): void {
    this.router.navigate(['/panel/servicios', serviceId, 'formulario']);
  }

  protected typeLabel(tipo: ServiceFormFieldType): string {
    return this.typeLabelsMap[tipo] || tipo;
  }

  protected applyDraftField(): void {
    this.validationError.set('');
    this.successMessage.set('');

    const currentFields = this.fields();
    const editIdx = this.editingIndex();

    if (editIdx === null && currentFields.length >= 15) {
      this.validationError.set('El servicio no puede superar el límite máximo de 15 campos.');
      return;
    }

    const etiqueta = this.draft.etiqueta.trim();
    if (!etiqueta) {
      this.validationError.set('La etiqueta del campo es obligatoria.');
      return;
    }

    const duplicateLabel = currentFields.some(
      (item, idx) =>
        idx !== editIdx && item.etiqueta.trim().toLowerCase() === etiqueta.toLowerCase(),
    );
    if (duplicateLabel) {
      this.validationError.set(
        `Ya existe un campo con la etiqueta "${etiqueta}". La etiqueta debe ser única dentro del formulario.`,
      );
      return;
    }

    const isSelection =
      this.draft.tipo === 'seleccion_unica' || this.draft.tipo === 'seleccion_multiple';
    let opciones: string[] = [];

    if (isSelection) {
      opciones = this.draft.opcionesTexto
        .split(',')
        .map((opt) => opt.trim())
        .filter(Boolean);

      if (opciones.length < 2) {
        this.validationError.set(
          'Los campos de selección deben tener al menos dos opciones separadas por coma.',
        );
        return;
      }

      const lowerOpts = opciones.map((opt) => opt.toLowerCase());
      if (new Set(lowerOpts).size !== lowerOpts.length) {
        this.validationError.set('Las opciones del campo de selección no pueden repetirse.');
        return;
      }
    }

    if (editIdx !== null) {
      const existing = currentFields[editIdx];
      const updatedField: ServiceFormField = {
        ...(existing?.id ? { id: existing.id } : {}),
        etiqueta,
        tipo: this.draft.tipo,
        obligatorio: Boolean(this.draft.obligatorio),
        textoAyuda: this.draft.textoAyuda.trim(),
        opciones: isSelection ? opciones : [],
        activo: Boolean(this.draft.activo),
        orden: editIdx,
      };
      this.fields.update((items) =>
        items.map((item, idx) => (idx === editIdx ? updatedField : item)),
      );
      this.editingIndex.set(null);
      this.draft = this.emptyDraft();
    } else {
      const newField: ServiceFormField = {
        etiqueta,
        tipo: this.draft.tipo,
        obligatorio: Boolean(this.draft.obligatorio),
        textoAyuda: this.draft.textoAyuda.trim(),
        opciones: isSelection ? opciones : [],
        activo: Boolean(this.draft.activo),
        orden: currentFields.length,
      };
      this.fields.update((items) => [...items, newField]);
      this.draft = this.emptyDraft();
    }
  }

  protected startEditField(index: number): void {
    const target = this.fields()[index];
    if (!target) return;
    this.validationError.set('');
    this.editingIndex.set(index);
    this.draft = {
      etiqueta: target.etiqueta,
      tipo: target.tipo,
      obligatorio: Boolean(target.obligatorio),
      textoAyuda: target.textoAyuda ?? '',
      opcionesTexto: (target.opciones ?? []).join(', '),
      activo: target.activo !== false,
    };
  }

  protected cancelEditField(): void {
    this.editingIndex.set(null);
    this.draft = this.emptyDraft();
    this.validationError.set('');
  }

  protected moveField(index: number, direction: -1 | 1): void {
    this.validationError.set('');
    this.successMessage.set('');
    this.fields.update((items) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= items.length) return items;
      const copy = [...items];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy.map((item, idx) => ({ ...item, orden: idx }));
    });
    if (this.editingIndex() !== null) {
      this.cancelEditField();
    }
  }

  protected toggleFieldActive(index: number): void {
    this.validationError.set('');
    this.successMessage.set('');
    this.fields.update((items) =>
      items.map((item, idx) => (idx === index ? { ...item, activo: item.activo === false } : item)),
    );
  }

  protected removeField(index: number): void {
    this.validationError.set('');
    this.successMessage.set('');
    this.fields.update((items) =>
      items.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, orden: idx })),
    );
    if (this.editingIndex() === index) {
      this.cancelEditField();
    }
  }

  protected clearAllFields(): void {
    this.validationError.set('');
    this.successMessage.set('');
    this.fields.set([]);
    this.cancelEditField();
  }

  protected saveFormToServer(): void {
    const currentService = this.activeService();
    if (!currentService) return;

    this.validationError.set('');
    this.successMessage.set('');

    const currentFields = this.fields();
    if (currentFields.length > 15) {
      this.validationError.set('El formulario no puede superar los 15 campos.');
      return;
    }

    const payload: ServiceFormField[] = currentFields.map((campo, index) => {
      const isSelection = campo.tipo === 'seleccion_unica' || campo.tipo === 'seleccion_multiple';
      return {
        ...(campo.id ? { id: campo.id } : {}),
        etiqueta: campo.etiqueta.trim(),
        tipo: campo.tipo,
        obligatorio: Boolean(campo.obligatorio),
        textoAyuda: (campo.textoAyuda ?? '').trim(),
        ...(isSelection ? { opciones: campo.opciones ?? [] } : {}),
        activo: campo.activo !== false,
        orden: index,
      };
    });

    this.saving.set(true);
    this.businessService.saveServiceForm(currentService.id, payload).subscribe({
      next: (response) => {
        this.fields.set(response.data.campos ?? []);
        this.saving.set(false);
        this.successMessage.set(
          `El formulario de "${currentService.nombre}" se guardó correctamente (${response.data.campos.length} campos).`,
        );
      },
      error: (error: ApiErrorResponse) => {
        this.saving.set(false);
        const detailMessage = error.error?.details?.[0]?.message;
        this.validationError.set(
          detailMessage ||
            error.error?.message ||
            'Ocurrió un error al guardar el formulario en el servidor.',
        );
      },
    });
  }

  protected primaryColor(): string {
    return this.business()?.personalizacion?.colorPrimario || '#2F6F78';
  }

  protected secondaryColor(): string {
    return this.business()?.personalizacion?.colorSecundario || '#B77942';
  }

  private loadServiceForm(service: BusinessServiceItem): void {
    this.activeService.set(service);
    this.validationError.set('');
    this.successMessage.set('');
    this.cancelEditField();
    this.loading.set(true);
    this.businessService.getManagedServiceForm(service.id).subscribe({
      next: (response) => {
        this.fields.set(response.data.campos ?? []);
        this.loading.set(false);
      },
      error: (error: ApiErrorResponse) => {
        this.loadError.set(error.error?.message ?? 'No se pudo cargar el formulario del servicio.');
        this.loading.set(false);
      },
    });
  }

  private emptyDraft(): DraftField {
    return {
      etiqueta: '',
      tipo: 'texto_corto',
      obligatorio: false,
      textoAyuda: '',
      opcionesTexto: '',
      activo: true,
    };
  }
}
