const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { Negocio, Rubro } = require('../src/models');
const negocioService = require('../src/services/negocio.service');
const {
  cleanRubroLabel,
  formatRubroLabel,
  hasDiacritics,
  normalizeRubroKey,
} = require('../src/utils/rubro.util');

test('cleanRubroLabel, hasDiacritics y formatRubroLabel limpian y formatean etiquetas', () => {
  assert.equal(cleanRubroLabel('  Estética   integral\t '), 'Estética integral');
  assert.equal(cleanRubroLabel(null), '');

  assert.equal(hasDiacritics('Estética'), true);
  assert.equal(hasDiacritics('Estetica'), false);

  assert.equal(formatRubroLabel('  veterinaria  '), 'Veterinaria');
  assert.equal(formatRubroLabel('  ESTÉTICA  '), 'Estética');
  assert.equal(formatRubroLabel('Servicios profesionales'), 'Servicios profesionales');
  assert.equal(formatRubroLabel('SPA'), 'SPA');
  assert.equal(formatRubroLabel('TI'), 'TI');
  assert.equal(formatRubroLabel('   '), '');
});

test('normalizeRubroKey agrupa variaciones de tildes, mayúsculas, espacios, plurales y género', () => {
  const variacionesEstetico = [
    'Estética',
    'estetica',
    'ESTÉTICA',
    '  estética  ',
    'estetico',
    'Estético',
    'ESTÉTICO',
    'esteticos',
    'Estéticos',
    'estéticas',
    '  eStÉtIcOs  ',
  ];

  const clavesEstetico = variacionesEstetico.map((item) => normalizeRubroKey(item));
  for (const clave of clavesEstetico) {
    assert.equal(clave, 'estetico');
  }

  assert.equal(normalizeRubroKey('  Servicios    profesionales  '), 'servicio profesional');
  assert.equal(normalizeRubroKey('Servicio profesional'), 'servicio profesional');
  assert.equal(normalizeRubroKey('servicios-profesionales'), 'servicio profesional');

  assert.equal(normalizeRubroKey('Barbería'), normalizeRubroKey('barberia'));
  assert.equal(normalizeRubroKey('BARBERÍAS'), normalizeRubroKey('barberia'));

  assert.equal(normalizeRubroKey('Veterinaria'), normalizeRubroKey('Veterinario'));
  assert.equal(normalizeRubroKey('veterinarias'), normalizeRubroKey('Veterinario'));

  assert.equal(normalizeRubroKey('Deporte'), normalizeRubroKey('Deportes'));
  assert.equal(normalizeRubroKey('Hotel'), normalizeRubroKey('Hoteles'));
  assert.equal(normalizeRubroKey('Taller mecánico'), normalizeRubroKey('Talleres mecánicos'));
  assert.equal(normalizeRubroKey('Automotriz'), normalizeRubroKey('Automotrices'));
  assert.equal(normalizeRubroKey('Clínica dental'), normalizeRubroKey('clinicas dentales'));
  assert.equal(normalizeRubroKey('Salón'), normalizeRubroKey('Salones'));
  assert.equal(normalizeRubroKey('Spa'), normalizeRubroKey('Spas'));
  assert.equal(normalizeRubroKey('Cine'), normalizeRubroKey('Cines'));
  assert.equal(normalizeRubroKey('Mueble'), normalizeRubroKey('Muebles'));
  assert.equal(normalizeRubroKey('Dulce'), normalizeRubroKey('Dulces'));
  assert.equal(normalizeRubroKey('Fitness'), 'fitness');
  assert.equal(normalizeRubroKey('Tenis'), 'tenis');
});

test('normalizeRubroKey mantiene separados rubros distintos y es idempotente', () => {
  const distintos = [
    'Salud',
    'Estética',
    'Barbería',
    'Veterinaria',
    'Deportes',
    'Servicios profesionales',
  ];
  const claves = distintos.map((item) => normalizeRubroKey(item));
  assert.equal(new Set(claves).size, distintos.length);

  const muestras = [
    ...distintos,
    'esteticos',
    'talleres mecanicos',
    'automotrices',
    'clinicas dentales',
    'servicios-profesionales',
    'spa',
    'fitness',
    'tenis',
    'dulces',
    'cines',
    'muebles',
  ];
  for (const muestra of muestras) {
    const clave = normalizeRubroKey(muestra);
    assert.equal(normalizeRubroKey(clave), clave);
  }

  assert.equal(normalizeRubroKey(''), '');
  assert.equal(normalizeRubroKey('   '), '');
  assert.equal(normalizeRubroKey('---!!!---'), '');
  assert.equal(normalizeRubroKey(123), '');
});

test('listarNegocios filtra por rubro normalizado combinando documentos nuevos y heredados', async (t) => {
  let capturedFilter = null;
  const docs = [
    {
      _id: new mongoose.Types.ObjectId(),
      nombre: 'Centro Estético Sur',
      rubro: 'Estética',
      rubroNormalizado: 'estetico',
      slug: 'centro-estetico-sur',
      descripcion: 'Cuidado facial',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      nombre: 'Estética Heredada',
      rubro: '  esteticos ',
      slug: 'estetica-heredada',
      descripcion: 'Documento legacy sin rubroNormalizado',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      nombre: 'Clínica Norte',
      rubro: 'Salud',
      slug: 'clinica-norte',
      descripcion: 'Atención médica',
    },
  ];

  t.mock.method(Negocio, 'find', (filter) => {
    capturedFilter = filter;
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      lean: async () => docs,
    };
  });

  const resultado = await negocioService.listarNegocios({
    search: 'Estét',
    rubro: '  ESTÉTICOS  ',
  });

  assert.ok(Array.isArray(capturedFilter.$and));
  assert.equal(capturedFilter.$and.length, 3);
  assert.equal(resultado.length, 2);
  assert.deepEqual(
    resultado.map((item) => item.slug),
    ['centro-estetico-sur', 'estetica-heredada'],
  );
});

test('listarNegocios retorna [] sin consultar BD cuando rubro solo contiene signos', async (t) => {
  const findMock = t.mock.method(Negocio, 'find', () => {
    throw new Error('No debería consultar Negocio.find');
  });

  const resultado = await negocioService.listarNegocios({ rubro: '!!!' });
  assert.deepEqual(resultado, []);
  assert.equal(findMock.mock.callCount(), 0);
});

test('listarRubros unifica variaciones, prefiere tildes en datos legacy, agrega nuevos y ordena', async (t) => {
  const negociosActivos = [
    { rubro: 'estetica' },
    { rubro: 'Estética' },
    { rubro: 'estetico', rubroNormalizado: 'estetico' },
    { rubro: 'Veterinaria', rubroNormalizado: 'veterinario' },
  ];
  const rubrosCatalogo = [{ nombre: 'Veterinaria', claveNormalizada: 'veterinario' }];
  const upsertedCalls = [];

  t.mock.method(Negocio, 'find', () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    lean: async () => negociosActivos,
  }));
  t.mock.method(Rubro, 'find', () => ({
    select() {
      return this;
    },
    lean: async () => rubrosCatalogo,
  }));
  t.mock.method(Rubro, 'findOneAndUpdate', async (query, update) => {
    upsertedCalls.push({ query, update });
    return update.$setOnInsert;
  });

  const rubros = await negocioService.listarRubros();

  assert.deepEqual(rubros, [
    { clave: 'estetico', nombre: 'Estética' },
    { clave: 'veterinario', nombre: 'Veterinaria' },
  ]);
  assert.equal(upsertedCalls.length, 1);
  assert.equal(upsertedCalls[0].query.claveNormalizada, 'estetico');
  assert.equal(upsertedCalls[0].update.$setOnInsert.nombre, 'Estética');
});
