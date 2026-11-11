const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const { Negocio, Servicio, Disponibilidad } = require('../src/models');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_disponibilidad';
const SECRET = process.env.JWT_SECRET || 'desarrollo-local-secreto-seguro-123456';

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await Disponibilidad.syncIndexes();
});
after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
beforeEach(async () => {
  await Negocio.deleteMany({});
  await Servicio.deleteMany({});
  await Disponibilidad.deleteMany({});
});

function token(rol, negocioId) {
  return jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), rol, ...(negocioId ? { negocioId } : {}) },
    SECRET,
  );
}

async function fixture(slug) {
  const negocio = await Negocio.create({ nombre: slug, rubro: 'Salud', slug });
  const servicio = await Servicio.create({
    negocioId: negocio._id,
    nombre: 'Consulta',
    duracionMin: 30,
    precio: 10000,
  });
  return { negocio, servicio };
}

test('admin configura y consulta el horario semanal de un servicio', async () => {
  const { negocio, servicio } = await fixture('horarios');
  const authorization = `Bearer ${token('admin', negocio._id.toString())}`;
  const response = await request(app)
    .put(`/api/gestion/negocios/${negocio._id}/servicios/${servicio._id}/disponibilidad`)
    .set('Authorization', authorization)
    .send({ dias: ['lunes', 'miércoles', 5], horaInicio: '09:00', horaFin: '18:00' })
    .expect(200);

  assert.deepEqual(response.body.data.dias, [1, 3, 5]);
  assert.equal(response.body.data.horaInicio, '09:00');
  assert.equal(response.body.data.horaFin, '18:00');

  const listed = await request(app)
    .get(`/api/gestion/negocios/${negocio._id}/servicios/${servicio._id}/disponibilidad`)
    .set('Authorization', authorization)
    .expect(200);
  assert.equal(listed.body.data.length, 1);
  assert.deepEqual(listed.body.data[0].dias, [1, 3, 5]);
});

test('rechaza rangos inválidos y días fuera de la semana', async () => {
  const { negocio, servicio } = await fixture('validacion-horarios');
  const authorization = `Bearer ${token('admin', negocio._id.toString())}`;
  const response = await request(app)
    .put(`/api/gestion/negocios/${negocio._id}/servicios/${servicio._id}/disponibilidad`)
    .set('Authorization', authorization)
    .send({ dias: [7], horaInicio: '18:00', horaFin: '09:00' })
    .expect(400);

  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(response.body.error.details.some((detail) => detail.field === 'dias'));
  assert.ok(response.body.error.details.some((detail) => detail.field === 'horaFin'));
});

test('impide configurar un servicio que pertenece a otro negocio', async () => {
  const first = await fixture('negocio-propio');
  const second = await fixture('negocio-ajeno');
  const authorization = `Bearer ${token('admin', first.negocio._id.toString())}`;

  await request(app)
    .put(
      `/api/gestion/negocios/${first.negocio._id}/servicios/${second.servicio._id}/disponibilidad`,
    )
    .set('Authorization', authorization)
    .send({ dias: [1], horaInicio: '09:00', horaFin: '17:00' })
    .expect(404);
});

test('impide que el administrador acceda a la ruta de otro negocio aunque envíe negocioId en el cuerpo', async () => {
  const first = await fixture('negocio-token');
  const second = await fixture('negocio-ruta');
  const authorization = `Bearer ${token('admin', first.negocio._id.toString())}`;

  await request(app)
    .get(
      `/api/gestion/negocios/${second.negocio._id}/servicios/${second.servicio._id}/disponibilidad`,
    )
    .set('Authorization', authorization)
    .send({ negocioId: first.negocio._id })
    .expect(403);
});
