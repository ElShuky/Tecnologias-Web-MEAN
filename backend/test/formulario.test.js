const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const { connectDatabase } = require('../src/database');
const { Negocio, Servicio } = require('../src/models');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_formularios';
const SECRET = process.env.JWT_SECRET || 'desarrollo-local-secreto-seguro-123456';

before(async () => {
  await connectDatabase(URI);
  await Negocio.syncIndexes();
  await Servicio.syncIndexes();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Negocio.deleteMany({});
  await Servicio.deleteMany({});
});

function token(rol, negocioId) {
  return jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), rol, ...(negocioId ? { negocioId } : {}) },
    SECRET,
  );
}

async function createBusinessAndServices(slug) {
  const negocio = await Negocio.create({ nombre: slug, rubro: 'Barbería', slug });
  const servicioA = await Servicio.create({
    negocioId: negocio._id,
    nombre: 'Corte clásico',
    duracionMin: 30,
    precio: 12000,
  });
  const servicioB = await Servicio.create({
    negocioId: negocio._id,
    nombre: 'Coloración y tratamiento',
    duracionMin: 60,
    precio: 25000,
  });
  return { negocio, servicioA, servicioB };
}

test('un administrador define formularios distintos para dos de sus servicios y GET público solo expone campos activos de servicios activos', async () => {
  const { negocio, servicioA, servicioB } = await createBusinessAndServices('barberia-form');
  const authorization = `Bearer ${token('admin', negocio._id.toString())}`;

  const resA = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [
        {
          etiqueta: 'Estilo deseado',
          tipo: 'texto corto',
          obligatorio: true,
          textoAyuda: 'Ej. degradado bajo o corte con tijera',
        },
        {
          etiqueta: 'Tipo de acabado',
          tipo: 'selección única',
          obligatorio: true,
          opciones: ['Natural', 'Texturizado', 'Clásico'],
        },
        {
          etiqueta: 'Campo interno oculto',
          tipo: 'texto largo',
          obligatorio: false,
          activo: false,
        },
      ],
    })
    .expect(200);

  assert.equal(resA.body.data.campos.length, 3);
  assert.equal(resA.body.data.campos[0].tipo, 'texto_corto');
  assert.equal(resA.body.data.campos[1].tipo, 'seleccion_unica');
  assert.ok(resA.body.data.campos[0].id);

  const resB = await request(app)
    .put(`/api/servicios/${servicioB._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [
        {
          etiqueta: '¿Tiene alergias capilares?',
          tipo: 'sí/no',
          obligatorio: true,
        },
        {
          etiqueta: 'Fecha última tintura',
          tipo: 'fecha',
          obligatorio: false,
        },
        {
          etiqueta: 'Productos utilizados',
          tipo: 'selección múltiple',
          obligatorio: false,
          opciones: ['Decolorante', 'Tinte permanente', 'Henna'],
        },
        {
          etiqueta: 'Largo estimado en cm',
          tipo: 'número',
          obligatorio: false,
        },
      ],
    })
    .expect(200);

  assert.equal(resB.body.data.campos.length, 4);

  const publicA = await request(app).get(`/api/servicios/${servicioA._id}/formulario`).expect(200);
  assert.equal(publicA.body.data.campos.length, 2);
  assert.deepEqual(
    publicA.body.data.campos.map((c) => c.etiqueta),
    ['Estilo deseado', 'Tipo de acabado'],
  );

  const publicB = await request(app).get(`/api/servicios/${servicioB._id}/formulario`).expect(200);
  assert.equal(publicB.body.data.campos.length, 4);
  assert.deepEqual(
    publicB.body.data.campos.map((c) => c.tipo),
    ['si_no', 'fecha', 'seleccion_multiple', 'numero'],
  );

  // Al desactivar el servicio, el endpoint público no debe exponer su formulario
  await Servicio.findByIdAndUpdate(servicioA._id, { activo: false });
  await request(app).get(`/api/servicios/${servicioA._id}/formulario`).expect(404);
});

test('permite editar, reordenar, desactivar y eliminar campos manteniendo un id estable, y acepta formulario vacío', async () => {
  const { negocio, servicioA } = await createBusinessAndServices('edicion-form');
  const authorization = `Bearer ${token('admin', negocio._id.toString())}`;

  const initial = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [
        { etiqueta: 'Campo 1', tipo: 'texto_corto', obligatorio: true },
        { etiqueta: 'Campo 2', tipo: 'numero', obligatorio: false },
        { etiqueta: 'Campo 3', tipo: 'fecha', obligatorio: false },
      ],
    })
    .expect(200);

  const [campo1, campo2, campo3] = initial.body.data.campos;

  // Reordenar (Campo 3 primero, Campo 1 editado y desactivado segundo, Campo 2 eliminado)
  const updated = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [
        {
          id: campo3.id,
          etiqueta: 'Campo 3 reordenado',
          tipo: 'fecha',
          obligatorio: true,
          activo: true,
        },
        {
          id: campo1.id,
          etiqueta: 'Campo 1 editado',
          tipo: 'texto_largo',
          obligatorio: false,
          activo: false,
        },
      ],
    })
    .expect(200);

  assert.equal(updated.body.data.campos.length, 2);
  assert.equal(updated.body.data.campos[0].id, campo3.id);
  assert.equal(updated.body.data.campos[0].orden, 0);
  assert.equal(updated.body.data.campos[1].id, campo1.id);
  assert.equal(updated.body.data.campos[1].orden, 1);
  assert.equal(updated.body.data.campos[1].activo, false);
  assert.ok(!updated.body.data.campos.some((c) => c.id === campo2.id));

  // El endpoint de gestión retorna todos los campos incluidos los inactivos
  const managed = await request(app)
    .get(`/api/gestion/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .expect(200);
  assert.equal(managed.body.data.campos.length, 2);

  // El endpoint público solo retorna el campo activo
  const pub = await request(app).get(`/api/servicios/${servicioA._id}/formulario`).expect(200);
  assert.equal(pub.body.data.campos.length, 1);
  assert.equal(pub.body.data.campos[0].id, campo3.id);

  // Acepta formulario vacío para servicios que no necesiten datos adicionales
  const empty = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({ campos: [] })
    .expect(200);
  assert.deepEqual(empty.body.data.campos, []);
});

test('rechaza tipos no permitidos, etiquetas vacías o duplicadas, selecciones sin opciones o repetidas y más de 15 campos', async () => {
  const { negocio, servicioA } = await createBusinessAndServices('validaciones-form');
  const authorization = `Bearer ${token('admin', negocio._id.toString())}`;

  // Tipo no permitido
  const invalidType = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [{ etiqueta: 'Archivo adjunto', tipo: 'archivo' }],
    })
    .expect(400);
  assert.equal(invalidType.body.error.code, 'VALIDATION_ERROR');

  // Etiquetas repetidas (case-insensitive)
  const duplicateLabel = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [
        { etiqueta: 'Teléfono de emergencia', tipo: 'texto_corto' },
        { etiqueta: 'teléfono de emergencia', tipo: 'numero' },
      ],
    })
    .expect(400);
  assert.equal(duplicateLabel.body.error.code, 'VALIDATION_ERROR');

  // Selección sin al menos dos opciones
  const missingOptions = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [{ etiqueta: 'Preferencia', tipo: 'seleccion_unica', opciones: ['Solo una'] }],
    })
    .expect(400);
  assert.equal(missingOptions.body.error.code, 'VALIDATION_ERROR');

  // Selección con opciones repetidas
  const repeatedOptions = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({
      campos: [
        {
          etiqueta: 'Extras',
          tipo: 'seleccion_multiple',
          opciones: ['Toalla caliente', 'toalla caliente'],
        },
      ],
    })
    .expect(400);
  assert.equal(repeatedOptions.body.error.code, 'VALIDATION_ERROR');

  // Más de 15 campos
  const sixteenFields = Array.from({ length: 16 }, (_, idx) => ({
    etiqueta: `Campo ${idx + 1}`,
    tipo: 'texto_corto',
  }));
  const tooMany = await request(app)
    .put(`/api/servicios/${servicioA._id}/formulario`)
    .set('Authorization', authorization)
    .send({ campos: sixteenFields })
    .expect(400);
  assert.equal(tooMany.body.error.code, 'VALIDATION_ERROR');
});

test('ningún administrador accede ni modifica los formularios de otro negocio', async () => {
  const propio = await createBusinessAndServices('negocio-propio');
  const ajeno = await createBusinessAndServices('negocio-ajeno');
  const authorizationPropio = `Bearer ${token('admin', propio.negocio._id.toString())}`;

  await request(app)
    .put(`/api/servicios/${ajeno.servicioA._id}/formulario`)
    .set('Authorization', authorizationPropio)
    .send({
      negocioId: propio.negocio._id.toString(),
      campos: [{ etiqueta: 'Intento intruso', tipo: 'texto_corto' }],
    })
    .expect(404);

  await request(app)
    .get(`/api/gestion/servicios/${ajeno.servicioA._id}/formulario`)
    .set('Authorization', authorizationPropio)
    .expect(404);

  // Cliente o superadmin sin rol admin de negocio tampoco pueden usar PUT /api/servicios/:id/formulario
  await request(app)
    .put(`/api/servicios/${propio.servicioA._id}/formulario`)
    .set('Authorization', `Bearer ${token('cliente')}`)
    .send({ campos: [] })
    .expect(403);
});
