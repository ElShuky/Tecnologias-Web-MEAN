import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { BookingService } from '../../core/services/booking.service';
import { BusinessService } from '../../core/services/business.service';
import { ServiceFormField } from '../../core/models/service.model';
import { Booking } from './booking';

describe('Booking (formulario dinámico del cliente)', () => {
  const queryParamMap$ = new BehaviorSubject(
    convertToParamMap({ slug: 'barberia-central', serviceId: 'srv-1' }),
  );

  let simulateConflict = false;
  let simulateServer400 = false;
  let lastCreatedPayload: unknown = null;

  const serviceForms: Record<string, ServiceFormField[]> = {
    'srv-1': [
      {
        id: 'c-1',
        etiqueta: 'Estilo de corte',
        tipo: 'seleccion_unica',
        obligatorio: true,
        textoAyuda: 'Selecciona el estilo',
        opciones: ['Clásico', 'Degradado'],
        activo: true,
        orden: 0,
      },
      {
        id: 'c-2',
        etiqueta: '¿Incluir perfilado?',
        tipo: 'si_no',
        obligatorio: true,
        textoAyuda: '',
        opciones: [],
        activo: true,
        orden: 1,
      },
      {
        id: 'c-3',
        etiqueta: 'Comentario breve',
        tipo: 'texto_corto',
        obligatorio: false,
        textoAyuda: '',
        opciones: [],
        activo: true,
        orden: 2,
      },
    ],
    'srv-2': [
      {
        id: 'c-9',
        etiqueta: 'Tratamientos extra',
        tipo: 'seleccion_multiple',
        obligatorio: true,
        opciones: ['Vapor', 'Mascarilla'],
        activo: true,
        orden: 0,
      },
    ],
    'srv-empty': [],
  };

  const mockBusinessService = {
    getPublic: () =>
      of({
        success: true,
        data: {
          id: 'biz-1',
          nombre: 'Barbería Central',
          rubro: 'Estética',
          slug: 'barberia-central',
          descripcion: 'Cortes',
          logoUrl: '',
          portadaUrl: '',
          activo: true,
          enlacePublico: 'http://localhost:8080/negocios/barberia-central',
        },
      }),
    getService: (_slug: string, serviceId: string) =>
      of({
        success: true,
        data: {
          id: serviceId,
          nombre: serviceId === 'srv-1' ? 'Corte y Barba' : 'Ritual Facial',
          descripcion: 'Atención',
          duracionMin: 30,
          precio: 12000,
          activo: true,
        },
      }),
    getServiceForm: (serviceId: string) =>
      of({
        success: true,
        data: {
          servicioId: serviceId,
          campos: serviceForms[serviceId] ?? [],
        },
      }),
  };

  const mockBookingService = {
    getBlocks: () =>
      of({
        success: true,
        data: {
          fecha: '2026-11-12',
          servicioId: 'srv-1',
          bloques: [
            { hora: '09:00', horaFin: '09:30', ocupado: false, seleccionable: true },
            { hora: '09:30', horaFin: '10:00', ocupado: false, seleccionable: true },
          ],
        },
      }),
    create: (payload: unknown) => {
      lastCreatedPayload = payload;
      if (simulateConflict) {
        return throwError(() => ({
          error: {
            code: 'CONFLICT',
            message: 'El bloque ya fue ocupado.',
          },
        }));
      }
      if (simulateServer400) {
        return throwError(() => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Error en campo del servidor.',
            details: [
              {
                field: 'c-3',
                message: 'El servidor rechazó el texto del comentario.',
              },
            ],
          },
        }));
      }
      return of({
        success: true,
        data: { id: 'res-1' },
      });
    },
  };

  beforeEach(async () => {
    simulateConflict = false;
    simulateServer400 = false;
    lastCreatedPayload = null;
    queryParamMap$.next(convertToParamMap({ slug: 'barberia-central', serviceId: 'srv-1' }));

    await TestBed.configureTestingModule({
      imports: [Booking],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$.asObservable() } },
        { provide: BusinessService, useValue: mockBusinessService },
        { provide: BookingService, useValue: mockBookingService },
      ],
    }).compileComponents();
  });

  it('muestra solo los campos de cada servicio, valida obligatoriedad/tipos, conserva respuestas en conflicto 409 y muestra errores 400 por campo', async () => {
    const fixture = TestBed.createComponent(Booking);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Marca campos obligatorios con asterisco y la palabra Obligatorio
    expect(compiled.querySelector('.req-badge')?.textContent).toContain('* Obligatorio');

    const component = fixture.componentInstance as unknown as {
      formFields: () => ServiceFormField[];
      selectBlock: (block: {
        hora: string;
        horaFin: string;
        ocupado: boolean;
        seleccionable: boolean;
      }) => void;
      confirmBooking: () => void;
      setBooleanValue: (id: string, val: boolean) => void;
      getControl: (id: string) => { setValue: (v: unknown) => void; value: unknown } | null;
      getFieldErrorMessage: (id: string) => string;
      isCustomFormValid: () => boolean;
      notes: string;
    };

    expect(component.formFields().length).toBe(3);
    component.selectBlock({ hora: '09:00', horaFin: '09:30', ocupado: false, seleccionable: true });

    // No puede confirmar con datos obligatorios faltantes
    expect(component.isCustomFormValid()).toBe(false);
    component.confirmBooking();
    expect(lastCreatedPayload).toBeNull();
    expect(component.getFieldErrorMessage('c-1')).toContain('obligatorio');

    // Completa los campos obligatorios
    component.getControl('c-1')?.setValue('Degradado');
    component.setBooleanValue('c-2', true);
    component.getControl('c-3')?.setValue('Corte bajo');
    component.notes = 'Nota mantenida';
    expect(component.isCustomFormValid()).toBe(true);

    // Si el bloque se ocupa (409 CONFLICT), conserva lo ingresado en el formulario
    simulateConflict = true;
    component.confirmBooking();
    expect(component.getControl('c-1')?.value).toBe('Degradado');
    expect(component.getControl('c-2')?.value).toBe(true);
    expect(component.getControl('c-3')?.value).toBe('Corte bajo');
    expect(component.notes).toBe('Nota mantenida');

    // Si el servidor responde HTTP 400 indicando qué campo falla, muestra el error en ese campo
    simulateConflict = false;
    simulateServer400 = true;
    component.selectBlock({ hora: '09:30', horaFin: '10:00', ocupado: false, seleccionable: true });
    component.confirmBooking();
    expect(component.getFieldErrorMessage('c-3')).toContain(
      'El servidor rechazó el texto del comentario.',
    );

    // Al cambiar a un servicio sin formulario, no muestra la sección de campos adicionales
    queryParamMap$.next(convertToParamMap({ slug: 'barberia-central', serviceId: 'srv-empty' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.formFields().length).toBe(0);
    expect(compiled.querySelector('.custom-booking-form')).toBeNull();
  });
});
