import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService } from '../../core/services/business.service';
import { ServiceFormField } from '../../core/models/service.model';
import { ServiceFormBuilder } from './service-form-builder';

describe('ServiceFormBuilder', () => {
  const paramMap$ = new BehaviorSubject(convertToParamMap({ serviceId: 'srv-1' }));

  const formsStore: Record<string, ServiceFormField[]> = {
    'srv-1': [
      {
        id: 'f-1',
        etiqueta: 'Estilo de corte',
        tipo: 'seleccion_unica',
        obligatorio: true,
        textoAyuda: 'Elige tu estilo',
        opciones: ['Clásico', 'Degradado'],
        activo: true,
        orden: 0,
      },
    ],
    'srv-2': [
      {
        id: 'f-2',
        etiqueta: '¿Tiene alergias?',
        tipo: 'si_no',
        obligatorio: true,
        textoAyuda: '',
        opciones: [],
        activo: true,
        orden: 0,
      },
    ],
  };

  const mockBusinessService = {
    getForManagement: () =>
      of({
        success: true,
        data: {
          id: 'biz-1',
          nombre: 'Barbería Central',
          rubro: 'Estética',
          slug: 'barberia-central',
          descripcion: 'Cortes y barba',
          logoUrl: '',
          portadaUrl: '',
          activo: true,
          enlacePublico: 'http://localhost:8080/negocios/barberia-central',
        },
      }),
    listManagedServices: () =>
      of({
        success: true,
        data: [
          {
            id: 'srv-1',
            nombre: 'Corte y Barba',
            descripcion: 'Corte clásico',
            duracionMin: 30,
            precio: 12000,
            activo: true,
          },
          {
            id: 'srv-2',
            nombre: 'Ritual de Barba y Spa Facial',
            descripcion: 'Spa facial',
            duracionMin: 45,
            precio: 16000,
            activo: true,
          },
        ],
      }),
    getManagedServiceForm: (serviceId: string) =>
      of({
        success: true,
        data: {
          servicioId: serviceId,
          campos: [...(formsStore[serviceId] || [])],
        },
      }),
    saveServiceForm: (serviceId: string, campos: ServiceFormField[]) => {
      if (campos.some((c) => c.etiqueta === 'ErrorServidor')) {
        return throwError(() => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Error del servidor simulado en español.',
          },
        }));
      }
      const saved = campos.map((c, idx) => ({
        ...c,
        id: c.id || `gen-${idx + 1}`,
        orden: idx,
      }));
      formsStore[serviceId] = saved;
      return of({
        success: true,
        data: {
          servicioId: serviceId,
          campos: saved,
        },
      });
    },
  };

  const mockAuthService = {
    currentUser: () => ({
      id: 'usr-admin',
      nombre: 'Admin',
      correo: 'admin@demo.cl',
      rol: 'admin' as const,
      negocioId: 'biz-1',
    }),
  };

  beforeEach(async () => {
    paramMap$.next(convertToParamMap({ serviceId: 'srv-1' }));
    await TestBed.configureTestingModule({
      imports: [ServiceFormBuilder],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        { provide: AuthService, useValue: mockAuthService },
        { provide: BusinessService, useValue: mockBusinessService },
      ],
    }).compileComponents();
  });

  it('crea, edita, reordena y desactiva campos mostrando la vista previa y distinguiendo formularios entre dos servicios', async () => {
    const fixture = TestBed.createComponent(ServiceFormBuilder);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      fields: () => ServiceFormField[];
      activePreviewFields: () => ServiceFormField[];
      draft: {
        etiqueta: string;
        tipo: string;
        obligatorio: boolean;
        textoAyuda: string;
        opcionesTexto: string;
        activo: boolean;
      };
      applyDraftField: () => void;
      startEditField: (idx: number) => void;
      moveField: (idx: number, dir: -1 | 1) => void;
      toggleFieldActive: (idx: number) => void;
      saveFormToServer: () => void;
      validationError: () => string;
      successMessage: () => string;
    };

    // Servicio 1 inicialmente tiene 1 campo
    expect(component.fields().length).toBe(1);
    expect(component.fields()[0].etiqueta).toBe('Estilo de corte');

    // Validación en el navegador: rechaza etiqueta duplicada y selección con menos de 2 opciones
    component.draft.etiqueta = 'estilo de corte';
    component.applyDraftField();
    expect(component.validationError()).toContain('única');

    component.draft.etiqueta = 'Extras deseados';
    component.draft.tipo = 'seleccion_multiple';
    component.draft.opcionesTexto = 'SoloUna';
    component.applyDraftField();
    expect(component.validationError()).toContain('al menos dos opciones');

    // Agrega un segundo campo válido
    component.draft.etiqueta = 'Observaciones adicionales';
    component.draft.tipo = 'texto_largo';
    component.draft.obligatorio = false;
    component.draft.textoAyuda = 'Detalla tus preferencias';
    component.applyDraftField();
    expect(component.fields().length).toBe(2);
    expect(component.activePreviewFields().length).toBe(2);

    // Reordena (sube el segundo campo al primer lugar)
    component.moveField(1, -1);
    expect(component.fields()[0].etiqueta).toBe('Observaciones adicionales');
    expect(component.fields()[1].etiqueta).toBe('Estilo de corte');

    // Edita el primer campo
    component.startEditField(0);
    component.draft.etiqueta = 'Notas para el barbero';
    component.applyDraftField();
    expect(component.fields()[0].etiqueta).toBe('Notas para el barbero');

    // Desactiva un campo y verifica que desaparece de la vista previa del cliente
    component.toggleFieldActive(0);
    expect(component.activePreviewFields().length).toBe(1);

    // Guarda en el servidor
    component.saveFormToServer();
    expect(component.successMessage()).toContain('se guardó correctamente');

    // Cambia al segundo servicio y verifica que tiene un formulario distinto
    paramMap$.next(convertToParamMap({ serviceId: 'srv-2' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.fields().length).toBe(1);
    expect(component.fields()[0].etiqueta).toBe('¿Tiene alergias?');
  });
});
