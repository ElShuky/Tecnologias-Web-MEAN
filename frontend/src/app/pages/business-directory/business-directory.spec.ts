import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { BusinessService } from '../../core/services/business.service';
import { BusinessDirectory } from './business-directory';

describe('BusinessDirectory', () => {
  const allBusinesses = [
    {
      id: 'biz-1',
      nombre: 'Barbería Central',
      rubro: 'Estética',
      slug: 'barberia-central',
      descripcion: 'Cortes clásicos.',
      enlacePublico: 'http://localhost:8080/negocios/barberia-central',
    },
    {
      id: 'biz-2',
      nombre: 'Patitas Felices',
      rubro: 'Veterinaria',
      slug: 'patitas-felices',
      descripcion: 'Cuidado animal.',
      enlacePublico: 'http://localhost:8080/negocios/patitas-felices',
    },
  ];

  let listSpy: ReturnType<typeof vi.fn>;
  let listRubrosSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listSpy = vi.fn((search = '', rubro = '') => {
      const filtered = allBusinesses.filter((item) => {
        const matchesRubro =
          !rubro ||
          (rubro === 'estetico' && item.rubro === 'Estética') ||
          (rubro === 'veterinario' && item.rubro === 'Veterinaria');
        const matchesSearch =
          !search || item.nombre.toLowerCase().includes(search.trim().toLowerCase());
        return matchesRubro && matchesSearch;
      });
      return of({ success: true, data: filtered });
    });

    listRubrosSpy = vi.fn(() =>
      of({
        success: true,
        data: [
          { clave: 'estetico', nombre: 'Estética' },
          { clave: 'veterinario', nombre: 'Veterinaria' },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [BusinessDirectory],
      providers: [
        provideRouter([]),
        {
          provide: BusinessService,
          useValue: {
            list: listSpy,
            listRubros: listRubrosSpy,
          },
        },
      ],
    }).compileComponents();
  });

  it('carga los rubros dinámicos incluyendo rubros nuevos creados', async () => {
    const fixture = TestBed.createComponent(BusinessDirectory);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const options = Array.from(host.querySelectorAll('select[name="category"] option')).map(
      (opt) => ({
        value: (opt as HTMLOptionElement).value,
        text: opt.textContent?.trim(),
      }),
    );

    expect(listRubrosSpy).toHaveBeenCalledTimes(1);
    expect(options).toEqual([
      { value: '', text: 'Todos los rubros' },
      { value: 'estetico', text: 'Estética' },
      { value: 'veterinario', text: 'Veterinaria' },
    ]);
  });

  it('filtra negocios al seleccionar un rubro y al enviar búsqueda combinada', async () => {
    const fixture = TestBed.createComponent(BusinessDirectory);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector('select[name="category"]') as HTMLSelectElement;
    select.value = 'veterinario';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(listSpy).toHaveBeenLastCalledWith('', 'veterinario');
    const cardsAfterRubro = Array.from(host.querySelectorAll('.directory-card h2')).map((el) =>
      el.textContent?.trim(),
    );
    expect(cardsAfterRubro).toEqual(['Patitas Felices']);

    const searchInput = host.querySelector('input[name="search"]') as HTMLInputElement;
    searchInput.value = 'Patitas';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = host.querySelector('form.filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(listSpy).toHaveBeenLastCalledWith('Patitas', 'veterinario');
  });

  it('mantiene operativo el buscador si falla la carga de rubros', async () => {
    listRubrosSpy.mockReturnValueOnce(throwError(() => new Error('Network error')));

    const fixture = TestBed.createComponent(BusinessDirectory);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const options = Array.from(host.querySelectorAll('select[name="category"] option')).map((opt) =>
      opt.textContent?.trim(),
    );
    expect(options).toEqual(['Todos los rubros']);
    expect(host.querySelectorAll('.directory-card').length).toBe(2);
  });
});
