const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const { Negocio, Servicio } = require('../src/models');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_servicios';
const SECRET = process.env.JWT_SECRET || 'desarrollo-local-secreto-seguro-123456';

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
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
async function createBusiness(slug) {
  return Negocio.create({ nombre: slug, rubro: 'Salud', slug });
}

test('CRUD de servicios aísla al administrador por negocio y permite superadmin', async () => {
  const first = await createBusiness('negocio-a');
  const second = await createBusiness('negocio-b');
  const adminToken = token('admin', first._id.toString());

  const forbidden = await request(app)
    .post(`/api/gestion/negocios/${second._id}/servicios`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Servicio', duracionMin: 30, precio: 10000, negocioId: first._id })
    .expect(403);
  assert.equal(forbidden.body.error.code, 'FORBIDDEN');

  const created = await request(app)
    .post(`/api/gestion/negocios/${first._id}/servicios`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Consulta', duracionMin: 30, precio: 10000, negocioId: second._id })
    .expect(201);
  assert.equal(created.body.data.negocioId, undefined);

  const serviceId = created.body.data.id;
  await request(app)
    .patch(`/api/gestion/negocios/${second._id}/servicios/${serviceId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ precio: 1 })
    .expect(403);

  const edited = await request(app)
    .patch(`/api/gestion/negocios/${first._id}/servicios/${serviceId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ precio: 12000 })
    .expect(200);
  assert.equal(edited.body.data.precio, 12000);

  await request(app)
    .delete(`/api/gestion/negocios/${first._id}/servicios/${serviceId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal((await Servicio.findById(serviceId)).activo, false);

  const secondService = await Servicio.create({
    negocioId: second._id,
    nombre: 'Global',
    duracionMin: 20,
    precio: 5000,
  });
  await request(app)
    .patch(`/api/gestion/negocios/${second._id}/servicios/${secondService._id}`)
    .set('Authorization', `Bearer ${token('superadmin')}`)
    .send({ activo: false })
    .expect(200);
});

test('listado público solo expone servicios activos del negocio solicitado', async () => {
  const business = await createBusiness('publico');
  await Servicio.create([
    { negocioId: business._id, nombre: 'Activo', duracionMin: 30, precio: 1000, activo: true },
    { negocioId: business._id, nombre: 'Inactivo', duracionMin: 30, precio: 1000, activo: false },
  ]);
  const response = await request(app).get('/api/negocios/publico/servicios').expect(200);
  assert.deepEqual(
    response.body.data.map((item) => item.nombre),
    ['Activo'],
  );
  assert.equal(response.body.data[0].negocioId, undefined);
});

test('rutas protegidas rechazan token ausente y datos de servicio inválidos', async () => {
  const business = await createBusiness('validacion');
  await request(app).get(`/api/gestion/negocios/${business._id}/servicios`).expect(401);
  const response = await request(app)
    .post(`/api/gestion/negocios/${business._id}/servicios`)
    .set('Authorization', `Bearer ${token('admin', business._id.toString())}`)
    .send({ nombre: 'X', duracionMin: 0, precio: -1 })
    .expect(400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});
