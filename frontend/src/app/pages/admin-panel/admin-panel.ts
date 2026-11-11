import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService } from '../../core/services/business.service';
import { Business, BusinessPersonalization } from '../../core/models/business.model';
import {
  BusinessServiceItem,
  ServiceFormField,
  ServiceFormFieldType,
  ServicePayload,
} from '../../core/models/service.model';
import { ApiErrorResponse } from '../../core/models/api-response.model';

interface EditableFormField {
  id?: string;
  etiqueta: string;
  tipo: ServiceFormFieldType;
  obligatorio: boolean;
  textoAyuda: string;
  opcionesTexto: string;
  activo: boolean;
}
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { StatusMessage } from '../../shared/ui/status-message/status-message';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [Button, Card, CurrencyPipe, FormsModule, RouterLink, StatusMessage],
  template: `
    <section
      class="page shell panel-page"
      [style.--primary]="personalization().colorPrimario || '#2F6F78'"
      [style.--secondary]="personalization().colorSecundario || '#B77942'"
      [style.--business-primary]="personalization().colorPrimario || '#2F6F78'"
      [style.--business-secondary]="personalization().colorSecundario || '#B77942'"
    >
      <p class="eyebrow">Administración del negocio</p>
      @if (business(); as activeBusiness) {
        <div class="fb-profile-card">
          <div class="fb-cover-stage">
            @if (personalization().portada || activeBusiness.portadaUrl; as cover) {
              <img
                class="fb-cover-image"
                [src]="cover"
                [alt]="'Portada de ' + activeBusiness.nombre"
              />
            }
            <div class="fb-cover-overlay"></div>
            <label class="fb-cover-upload-btn">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                (change)="uploadImage($event, 'portada')"
              />
              <span>Cambiar foto de portada</span>
            </label>
          </div>

          <div class="fb-profile-bar">
            <div class="fb-avatar-wrap">
              @if (personalization().logo || activeBusiness.logoUrl; as logo) {
                <img
                  class="fb-avatar-image"
                  [src]="logo"
                  [alt]="'Logotipo de ' + activeBusiness.nombre"
                />
              } @else {
                <div class="fb-avatar-placeholder">
                  {{ activeBusiness.nombre.slice(0, 1).toUpperCase() }}
                </div>
              }
              <label class="fb-avatar-upload-btn" title="Cambiar logotipo">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  (change)="uploadImage($event, 'logo')"
                />
                <span>Cambiar logo</span>
              </label>
            </div>

            <div class="fb-profile-info">
              <span class="business-category">{{ activeBusiness.rubro }}</span>
              <h1 class="fb-business-title">{{ activeBusiness.nombre }}</h1>
              <p class="fb-business-desc">
                {{
                  activeBusiness.descripcion ||
                    'Gestiona los servicios, disponibilidad y reservas de tu negocio.'
                }}
              </p>
              <div class="fb-public-link">
                <strong>Enlace público:</strong>
                <a [href]="activeBusiness.enlacePublico" target="_blank" rel="noopener">
                  {{ activeBusiness.enlacePublico }}
                </a>
              </div>
            </div>
          </div>
        </div>

        @if (uploadMessage()) {
          <div class="feedback-banner">
            <strong>{{ uploadMessage() }}</strong>
          </div>
        }

        <app-card id="personalizacion">
          <strong>Personalización visual</strong>
          <span>Sube imágenes de perfil (logotipo), portada y define los colores de tu marca.</span>
          <p class="personalization-note">
            Los cambios se guardan en tu negocio y se reflejan tanto aquí como en tu página pública.
          </p>

          <div class="personalization-controls-grid">
            <div class="personalization-control-box">
              <label class="upload-field">
                <span>Foto de perfil (Logotipo)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  (change)="uploadImage($event, 'logo')"
                />
              </label>
              @if (personalization().logo) {
                <img
                  class="image-preview logo-preview"
                  [src]="personalization().logo"
                  alt="Vista previa del logotipo"
                />
              }
              <button type="button" class="reset-button" (click)="clearImage('logo')">
                Quitar logotipo
              </button>
            </div>

            <div class="personalization-control-box">
              <label class="upload-field">
                <span>Foto de portada</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  (change)="uploadImage($event, 'portada')"
                />
              </label>
              @if (personalization().portada) {
                <img
                  class="image-preview cover-preview"
                  [src]="personalization().portada"
                  alt="Vista previa de la portada"
                />
              }
              <button type="button" class="reset-button" (click)="clearImage('portada')">
                Quitar portada
              </button>
            </div>
          </div>

          <div class="color-controls-row">
            <label class="upload-field">
              <span>Color primario ({{ personalization().colorPrimario || '#2F6F78' }})</span>
              <input
                type="color"
                [value]="personalization().colorPrimario || '#2F6F78'"
                (input)="previewColor($event, 'colorPrimario')"
                (change)="saveColor($event, 'colorPrimario')"
              />
            </label>
            <label class="upload-field">
              <span>Color secundario ({{ personalization().colorSecundario || '#B77942' }})</span>
              <input
                type="color"
                [value]="personalization().colorSecundario || '#B77942'"
                (input)="previewColor($event, 'colorSecundario')"
                (change)="saveColor($event, 'colorSecundario')"
              />
            </label>
            <button type="button" class="reset-button" (click)="resetColors()">
              Usar colores por defecto
            </button>
          </div>

          <app-button
            type="button"
            [disabled]="savingPersonalization()"
            (click)="savePersonalization()"
          >
            {{ savingPersonalization() ? 'Guardando...' : 'Guardar cambios' }}
          </app-button>
        </app-card>

        <app-card>
          <strong>Servicios del negocio</strong>
          <span>Crea nuevos servicios o modifica los existentes.</span>
          <div class="service-form">
            <input [(ngModel)]="serviceForm.nombre" placeholder="Nombre del servicio" />
            <textarea
              [(ngModel)]="serviceForm.descripcion"
              rows="2"
              placeholder="Descripción"
            ></textarea>
            <input
              [(ngModel)]="serviceForm.duracionMin"
              type="number"
              min="1"
              placeholder="Duración en minutos"
            />
            <input
              [(ngModel)]="serviceForm.precio"
              type="number"
              min="0"
              step="1"
              placeholder="Precio"
            />
            <div class="service-actions">
              <app-button (click)="saveService()">
                {{ editingServiceId() ? 'Guardar cambios' : 'Crear servicio' }}
              </app-button>
              @if (editingServiceId()) {
                <app-button variant="ghost" (click)="resetServiceForm()">Cancelar</app-button>
              }
            </div>
          </div>
          @if (services().length === 0) {
            <small class="upload-message">Todavía no hay servicios creados.</small>
          } @else {
            <div class="managed-services">
              @for (service of services(); track service.id) {
                <div class="managed-service" [class.is-inactive]="!service.activo">
                  <div>
                    <strong>{{ service.nombre }}</strong>
                    <span
                      >{{ service.duracionMin }} min ·
                      {{ service.precio | currency: 'CLP' : 'symbol-narrow' : '1.0-0' }}</span
                    >
                  </div>
                  <div class="service-actions">
                    <a
                      class="text-button"
                      [routerLink]="['/panel/servicios', service.id, 'formulario']"
                    >
                      Formulario del servicio
                    </a>
                    <button class="text-button" type="button" (click)="editService(service)">
                      Editar
                    </button>
                    @if (service.activo) {
                      <button
                        class="text-button danger"
                        type="button"
                        (click)="deactivateService(service)"
                      >
                        Desactivar
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </app-card>

        @if (selectedFormService(); as formService) {
          <app-card id="formulario-servicio">
            <div class="form-builder-header">
              <div>
                <strong>Formulario del servicio: {{ formService.nombre }}</strong>
                <span>
                  Define los datos adicionales que debe completar el cliente ({{
                    editableFields().length
                  }}/15 campos).
                </span>
              </div>
              <div class="service-actions">
                <button
                  type="button"
                  class="reset-button"
                  [disabled]="editableFields().length >= 15"
                  (click)="addFormField()"
                >
                  + Agregar campo
                </button>
                <button type="button" class="reset-button" (click)="clearAllFormFields()">
                  Dejar formulario vacío
                </button>
                <button type="button" class="reset-button" (click)="closeServiceFormBuilder()">
                  Cerrar
                </button>
              </div>
            </div>

            @if (editableFields().length === 0) {
              <p class="personalization-note">
                Este servicio no solicita datos adicionales (formulario vacío). Puedes guardar así o
                agregar hasta 15 campos.
              </p>
            } @else {
              <div class="form-builder-list">
                @for (field of editableFields(); track $index; let i = $index) {
                  <div class="form-builder-item" [class.is-inactive]="!field.activo">
                    <div class="form-builder-item-top">
                      <strong>Campo #{{ i + 1 }}</strong>
                      <div class="service-actions">
                        <button
                          type="button"
                          class="text-button"
                          [disabled]="i === 0"
                          (click)="moveFormField(i, -1)"
                        >
                          ↑ Subir
                        </button>
                        <button
                          type="button"
                          class="text-button"
                          [disabled]="i === editableFields().length - 1"
                          (click)="moveFormField(i, 1)"
                        >
                          ↓ Bajar
                        </button>
                        <button
                          type="button"
                          class="text-button danger"
                          (click)="removeFormField(i)"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div class="form-builder-grid">
                      <label class="upload-field">
                        <span>Etiqueta (obligatoria y única)</span>
                        <input
                          type="text"
                          [(ngModel)]="field.etiqueta"
                          placeholder="Ej. Estilo de corte o alergias"
                        />
                      </label>

                      <label class="upload-field">
                        <span>Tipo de dato</span>
                        <select [(ngModel)]="field.tipo">
                          @for (option of fieldTypeOptions; track option.value) {
                            <option [value]="option.value">{{ option.label }}</option>
                          }
                        </select>
                      </label>

                      <label class="upload-field">
                        <span>Texto de ayuda (opcional)</span>
                        <input
                          type="text"
                          [(ngModel)]="field.textoAyuda"
                          placeholder="Instrucción breve para el cliente"
                        />
                      </label>

                      @if (
                        field.tipo === 'seleccion_unica' || field.tipo === 'seleccion_multiple'
                      ) {
                        <label class="upload-field">
                          <span>Opciones (separadas por coma, mínimo 2 sin repetir)</span>
                          <input
                            type="text"
                            [(ngModel)]="field.opcionesTexto"
                            placeholder="Ej. Clásico, Degradado, Texturizado"
                          />
                        </label>
                      }
                    </div>

                    <div class="form-builder-flags">
                      <label class="checkbox-label">
                        <input type="checkbox" [(ngModel)]="field.obligatorio" />
                        <span>Respuesta obligatoria</span>
                      </label>
                      <label class="checkbox-label">
                        <input type="checkbox" [(ngModel)]="field.activo" />
                        <span>Campo activo (visible para clientes)</span>
                      </label>
                    </div>
                  </div>
                }
              </div>
            }

            <div class="service-actions">
              <app-button
                type="button"
                [disabled]="savingServiceForm()"
                (click)="saveServiceForm()"
              >
                {{ savingServiceForm() ? 'Guardando formulario...' : 'Guardar formulario' }}
              </app-button>
            </div>
          </app-card>
        }
      } @else if (errorMessage()) {
        <app-status-message
          type="error"
          title="No se pudo cargar el negocio"
          [message]="errorMessage()"
        />
      } @else {
        <app-status-message title="Cargando negocio" message="Estamos preparando tu panel." />
      }

      <div class="panel-grid">
        <app-card>
          <strong>Reservas</strong>
          <span>Consulta y administra las reservas de tu negocio.</span>
          <a class="panel-link" routerLink="/panel/reservas">Abrir agenda</a>
        </app-card>
        <app-card
          ><strong>Servicios</strong
          ><span>Configura precios, duración y estado de tus servicios.</span></app-card
        >
        <app-card
          ><strong>Disponibilidad</strong
          ><span>Define los horarios de atención para cada servicio.</span></app-card
        >
      </div>
      <app-button variant="ghost" (click)="logout()">Cerrar sesión</app-button>
    </section>
  `,
  styleUrl: './admin-panel.scss',
})
export class AdminPanel implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly businessService = inject(BusinessService);
  protected readonly business = signal<Business | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly uploadMessage = signal('');
  protected readonly savingPersonalization = signal(false);
  protected readonly personalization = signal<BusinessPersonalization>({
    logo: null,
    portada: null,
    colorPrimario: null,
    colorSecundario: null,
  });
  protected readonly services = signal<BusinessServiceItem[]>([]);
  protected readonly editingServiceId = signal('');
  protected serviceForm: ServicePayload = this.emptyServiceForm();
  protected readonly selectedFormService = signal<BusinessServiceItem | null>(null);
  protected readonly editableFields = signal<EditableFormField[]>([]);
  protected readonly savingServiceForm = signal(false);
  protected readonly fieldTypeOptions: { value: ServiceFormFieldType; label: string }[] = [
    { value: 'texto_corto', label: 'Texto corto' },
    { value: 'texto_largo', label: 'Texto largo' },
    { value: 'numero', label: 'Número' },
    { value: 'fecha', label: 'Fecha' },
    { value: 'si_no', label: 'Sí / No' },
    { value: 'seleccion_unica', label: 'Selección única' },
    { value: 'seleccion_multiple', label: 'Selección múltiple' },
  ];

  ngOnInit(): void {
    const businessId = this.auth.currentUser()?.negocioId;
    if (!businessId) {
      this.errorMessage.set('Tu cuenta no tiene un negocio asignado.');
      return;
    }
    this.businessService.getForManagement(businessId).subscribe({
      next: (response) => {
        this.business.set(response.data);
        if (response.data.personalizacion) {
          this.personalization.set(response.data.personalizacion);
        }
        this.businessService.listManagedServices(businessId).subscribe({
          next: (services) => this.services.set(services.data),
          error: (error: ApiErrorResponse) =>
            this.uploadMessage.set(error.error?.message ?? 'No se pudieron cargar los servicios.'),
        });
      },
      error: (error: ApiErrorResponse) =>
        this.errorMessage.set(error.error?.message ?? 'No se pudo cargar el negocio.'),
    });
    this.businessService.getPersonalization().subscribe({
      next: (response) => this.personalization.set(response.data),
      error: (error: ApiErrorResponse) =>
        this.uploadMessage.set(error.error?.message ?? 'No se pudo cargar la personalización.'),
    });
  }

  protected logout(): void {
    this.auth.logout();
  }

  protected uploadImage(event: Event, type: 'logo' | 'portada'): void {
    const businessId = this.auth.currentUser()?.negocioId;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!businessId || !file) return;
    this.uploadMessage.set('Subiendo imagen...');
    this.businessService.uploadImage(businessId, type, file).subscribe({
      next: (response) => {
        this.personalization.update((current) => ({
          ...current,
          [type]: response.data.url,
        }));
        this.business.update((current) =>
          current
            ? {
                ...current,
                logoUrl: type === 'logo' ? response.data.url : current.logoUrl,
                portadaUrl: type === 'portada' ? response.data.url : current.portadaUrl,
                personalizacion: {
                  logo:
                    type === 'logo' ? response.data.url : (current.personalizacion?.logo ?? null),
                  portada:
                    type === 'portada'
                      ? response.data.url
                      : (current.personalizacion?.portada ?? null),
                  colorPrimario: current.personalizacion?.colorPrimario ?? null,
                  colorSecundario: current.personalizacion?.colorSecundario ?? null,
                },
              }
            : null,
        );
        this.uploadMessage.set(
          `${type === 'logo' ? 'Logotipo' : 'Portada'} actualizada correctamente.`,
        );
        input.value = '';
      },
      error: (error: ApiErrorResponse) => {
        this.uploadMessage.set(error.error?.message ?? 'No se pudo cargar la imagen.');
        input.value = '';
      },
    });
  }

  protected previewColor(event: Event, field: 'colorPrimario' | 'colorSecundario'): void {
    const value = (event.target as HTMLInputElement).value.trim() || null;
    this.personalization.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

  protected saveColor(event: Event, field: 'colorPrimario' | 'colorSecundario'): void {
    const value = (event.target as HTMLInputElement).value.trim() || null;
    this.personalization.update((current) => ({
      ...current,
      [field]: value,
    }));
    this.businessService.updatePersonalization({ [field]: value }).subscribe({
      next: (response) => {
        this.personalization.set(response.data);
        this.uploadMessage.set('Color actualizado correctamente.');
      },
      error: (error: ApiErrorResponse) =>
        this.uploadMessage.set(error.error?.message ?? 'El color no es válido.'),
    });
  }

  protected clearImage(field: 'logo' | 'portada'): void {
    this.businessService.updatePersonalization({ [field]: null }).subscribe({
      next: (response) => {
        this.personalization.set(response.data);
        this.business.update((current) =>
          current
            ? {
                ...current,
                logoUrl: field === 'logo' ? '' : current.logoUrl,
                portadaUrl: field === 'portada' ? '' : current.portadaUrl,
                personalizacion: response.data,
              }
            : null,
        );
        this.uploadMessage.set(`${field === 'logo' ? 'Logotipo' : 'Portada'} quitada.`);
      },
      error: (error: ApiErrorResponse) =>
        this.uploadMessage.set(error.error?.message ?? 'No se pudo quitar la imagen.'),
    });
  }

  protected resetColors(): void {
    this.businessService
      .updatePersonalization({ colorPrimario: null, colorSecundario: null })
      .subscribe({
        next: (response) => {
          this.personalization.set(response.data);
          this.uploadMessage.set('Se restauraron los colores por defecto.');
        },
        error: (error: ApiErrorResponse) =>
          this.uploadMessage.set(error.error?.message ?? 'No se pudieron restaurar los colores.'),
      });
  }

  protected savePersonalization(): void {
    this.savingPersonalization.set(true);
    this.businessService.updatePersonalization(this.personalization()).subscribe({
      next: (response) => {
        this.personalization.set(response.data);
        this.uploadMessage.set('Personalización guardada correctamente.');
        this.savingPersonalization.set(false);
      },
      error: (error: ApiErrorResponse) => {
        this.uploadMessage.set(error.error?.message ?? 'No se pudo guardar la personalización.');
        this.savingPersonalization.set(false);
      },
    });
  }

  protected editService(service: BusinessServiceItem): void {
    this.editingServiceId.set(service.id);
    this.serviceForm = {
      nombre: service.nombre,
      descripcion: service.descripcion,
      duracionMin: service.duracionMin,
      precio: service.precio,
      activo: service.activo,
    };
  }

  protected resetServiceForm(): void {
    this.editingServiceId.set('');
    this.serviceForm = this.emptyServiceForm();
  }

  protected saveService(): void {
    const businessId = this.auth.currentUser()?.negocioId;
    if (!businessId) return;
    const payload: ServicePayload = {
      nombre: this.serviceForm.nombre.trim(),
      descripcion: this.serviceForm.descripcion.trim(),
      duracionMin: Number(this.serviceForm.duracionMin),
      precio: Number(this.serviceForm.precio),
      ...(this.serviceForm.activo !== undefined ? { activo: this.serviceForm.activo } : {}),
    };
    const request = this.editingServiceId()
      ? this.businessService.updateService(businessId, this.editingServiceId(), payload)
      : this.businessService.createService(businessId, payload);
    request.subscribe({
      next: (response) => {
        this.services.update((items) => {
          const exists = items.some((item) => item.id === response.data.id);
          return exists
            ? items.map((item) => (item.id === response.data.id ? response.data : item))
            : [...items, response.data];
        });
        this.uploadMessage.set(
          this.editingServiceId()
            ? 'Servicio actualizado correctamente.'
            : 'Servicio creado correctamente.',
        );
        this.resetServiceForm();
      },
      error: (error: ApiErrorResponse) =>
        this.uploadMessage.set(error.error?.message ?? 'No se pudo guardar el servicio.'),
    });
  }

  protected deactivateService(service: BusinessServiceItem): void {
    const businessId = this.auth.currentUser()?.negocioId;
    if (!businessId) return;
    this.businessService.deactivateService(businessId, service.id).subscribe({
      next: (response) => {
        this.services.update((items) =>
          items.map((item) => (item.id === service.id ? response.data : item)),
        );
        this.uploadMessage.set('Servicio desactivado correctamente.');
      },
      error: (error: ApiErrorResponse) =>
        this.uploadMessage.set(error.error?.message ?? 'No se pudo desactivar el servicio.'),
    });
  }

  private emptyServiceForm(): ServicePayload {
    return { nombre: '', descripcion: '', duracionMin: 30, precio: 0 };
  }

  protected openServiceFormBuilder(service: BusinessServiceItem): void {
    this.selectedFormService.set(service);
    this.businessService.getManagedServiceForm(service.id).subscribe({
      next: (response) => {
        const mapped = (response.data.campos ?? []).map((campo) => ({
          id: campo.id,
          etiqueta: campo.etiqueta,
          tipo: campo.tipo,
          obligatorio: Boolean(campo.obligatorio),
          textoAyuda: campo.textoAyuda ?? '',
          opcionesTexto: (campo.opciones ?? []).join(', '),
          activo: campo.activo !== false,
        }));
        this.editableFields.set(mapped);
      },
      error: (error: ApiErrorResponse) => {
        this.uploadMessage.set(
          error.error?.message ?? 'No se pudo cargar el formulario del servicio.',
        );
      },
    });
  }

  protected closeServiceFormBuilder(): void {
    this.selectedFormService.set(null);
    this.editableFields.set([]);
  }

  protected addFormField(): void {
    if (this.editableFields().length >= 15) return;
    this.editableFields.update((items) => [
      ...items,
      {
        etiqueta: '',
        tipo: 'texto_corto',
        obligatorio: false,
        textoAyuda: '',
        opcionesTexto: '',
        activo: true,
      },
    ]);
  }

  protected clearAllFormFields(): void {
    this.editableFields.set([]);
  }

  protected removeFormField(index: number): void {
    this.editableFields.update((items) => items.filter((_, idx) => idx !== index));
  }

  protected moveFormField(index: number, direction: -1 | 1): void {
    this.editableFields.update((items) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const copy = [...items];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  }

  protected saveServiceForm(): void {
    const activeService = this.selectedFormService();
    if (!activeService) return;
    this.savingServiceForm.set(true);

    const payload: ServiceFormField[] = this.editableFields().map((field, index) => {
      const isSelection = field.tipo === 'seleccion_unica' || field.tipo === 'seleccion_multiple';
      const opciones = isSelection
        ? field.opcionesTexto
            .split(',')
            .map((opt) => opt.trim())
            .filter(Boolean)
        : [];
      return {
        ...(field.id ? { id: field.id } : {}),
        etiqueta: field.etiqueta.trim(),
        tipo: field.tipo,
        obligatorio: Boolean(field.obligatorio),
        textoAyuda: field.textoAyuda.trim(),
        ...(isSelection ? { opciones } : {}),
        activo: Boolean(field.activo),
        orden: index,
      };
    });

    this.businessService.saveServiceForm(activeService.id, payload).subscribe({
      next: (response) => {
        const mapped = (response.data.campos ?? []).map((campo) => ({
          id: campo.id,
          etiqueta: campo.etiqueta,
          tipo: campo.tipo,
          obligatorio: Boolean(campo.obligatorio),
          textoAyuda: campo.textoAyuda ?? '',
          opcionesTexto: (campo.opciones ?? []).join(', '),
          activo: campo.activo !== false,
        }));
        this.editableFields.set(mapped);
        this.savingServiceForm.set(false);
        this.uploadMessage.set(
          `Formulario de "${activeService.nombre}" guardado correctamente (${mapped.length} campos).`,
        );
      },
      error: (error: ApiErrorResponse) => {
        this.savingServiceForm.set(false);
        const detailMsg = error.error?.details?.[0]?.message;
        this.uploadMessage.set(
          detailMsg || error.error?.message || 'No se pudo guardar el formulario del servicio.',
        );
      },
    });
  }
}
