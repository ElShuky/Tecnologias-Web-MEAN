const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/server');
const { Negocio, Usuario } = require('../src/models');

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_negocios';
const JWT_SECRET = process.env.JWT_SECRET || 'desarrollo-local-secreto-seguro-123456';

before(async () => {
  await mongoose.connect(TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await Negocio.syncIndexes();
  await Usuario.syncIndexes();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Negocio.deleteMany({});
  await Usuario.deleteMany({});
});

function superadminToken() {
  return jwt.sign({ sub: new mongoose.Types.ObjectId().toString(), rol: 'superadmin' }, JWT_SECRET);
}

test('POST /api/negocios crea negocio y administrador relacionados en una transacción', async () => {
  const response = await request(app)
    .post('/api/negocios')
    .set('Authorization', `Bearer ${superadminToken()}`)
    .send({
      nombre: 'Barbería Central',
      rubro: 'Belleza',
      slug: 'barberia-central',
      descripcion: 'Cortes y cuidado personal.',
      adminNombre: 'Admin Central',
      adminCorreo: 'admin@barberia.cl',
      adminPassword: 'PasswordAdmin123',
    })
    .expect(201);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.slug, 'barberia-central');
  assert.match(response.body.data.enlacePublico, /\/negocios\/barberia-central$/);
  assert.equal(response.body.data.adminPassword, undefined);

  const negocio = await Negocio.findOne({ slug: 'barberia-central' });
  const admin = await Usuario.findOne({ correo: 'admin@barberia.cl' });
  assert.ok(negocio);
  assert.ok(admin);
  assert.equal(admin.rol, 'admin');
  assert.equal(admin.negocioId.toString(), negocio._id.toString());
  assert.notEqual(admin.passwordHash, 'PasswordAdmin123');
  assert.equal(await bcrypt.compare('PasswordAdmin123', admin.passwordHash), true);
});

test('POST /api/negocios requiere superadmin y rechaza slug duplicado', async () => {
  const payload = {
    nombre: 'Negocio Uno',
    rubro: 'Salud',
    slug: 'negocio-uno',
    adminNombre: 'Admin Uno',
    adminCorreo: 'admin1@test.cl',
    adminPassword: 'PasswordUno123',
  };
  await request(app)
    .post('/api/negocios')
    .set('Authorization', `Bearer ${superadminToken()}`)
    .send(payload)
    .expect(201);

  const duplicado = await request(app)
    .post('/api/negocios')
    .set('Authorization', `Bearer ${superadminToken()}`)
    .send({ ...payload, adminCorreo: 'admin2@test.cl' })
    .expect(409);
  assert.equal(duplicado.body.error.code, 'CONFLICT');

  const clienteToken = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), rol: 'cliente' },
    JWT_SECRET,
  );
  await request(app)
    .post('/api/negocios')
    .set('Authorization', `Bearer ${clienteToken}`)
    .send({ ...payload, slug: 'otro-negocio' })
    .expect(403);
});

test('GET /api/negocios y GET /api/negocios/:slug devuelven solo negocios activos y datos públicos', async () => {
  await Negocio.create([
    {
      nombre: 'Clínica Norte',
      rubro: 'Salud',
      slug: 'clinica-norte',
      descripcion: 'Atención general.',
      activo: true,
    },
    {
      nombre: 'Barbería Oculta',
      rubro: 'Belleza',
      slug: 'barberia-oculta',
      descripcion: 'No visible.',
      activo: false,
    },
  ]);
  await Usuario.create({
    nombre: 'Admin Privado',
    correo: 'privado@test.cl',
    passwordHash: 'hash-no-publico',
    rol: 'admin',
    negocioId: (await Negocio.findOne({ slug: 'clinica-norte' }))._id,
  });

  const listado = await request(app)
    .get('/api/negocios')
    .query({ search: 'clínica', rubro: 'salud' })
    .expect(200);
  assert.equal(listado.body.data.length, 1);
  assert.equal(listado.body.data[0].slug, 'clinica-norte');
  assert.equal(listado.body.data[0].passwordHash, undefined);
  assert.equal(listado.body.data[0].adminCorreo, undefined);

  const detalle = await request(app).get('/api/negocios/clinica-norte').expect(200);
  assert.equal(detalle.body.data.nombre, 'Clínica Norte');
  assert.equal(detalle.body.data.adminCorreo, undefined);

  await request(app).get('/api/negocios/barberia-oculta').expect(404);
});
