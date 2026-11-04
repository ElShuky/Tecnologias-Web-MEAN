const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const { Negocio, Servicio, Disponibilidad, Reserva, Usuario } = require('../src/models');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_bloques';

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
});
after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
beforeEach(async () => {
  await Promise.all([
    Negocio.deleteMany({}),
    Servicio.deleteMany({}),
    Disponibilidad.deleteMany({}),
    Reserva.deleteMany({}),
    Usuario.deleteMany({}),
  ]);
});

async function fixture() {
  const negocio = await Negocio.create({
    nombre: 'Negocio Bloques',
    rubro: 'Salud',
    slug: 'negocio-bloques',
  });
  const servicio = await Servicio.create({
    negocioId: negocio._id,
    nombre: 'Consulta',
    duracionMin: 30,
    precio: 10000,
  });
  await Disponibilidad.create({
    negocioId: negocio._id,
    servicioId: servicio._id,
    dias: [1],
    horaInicio: '09:00',
    horaFin: '11:00',
  });
  return { negocio, servicio };
}

function nextMonday() {
  const date = new Date();
  const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return date.toISOString().slice(0, 10);
}

test('genera bloques dentro de la jornada y marca reservas confirmadas como ocupadas', async () => {
  const { negocio, servicio } = await fixture();
  const fecha = nextMonday();
  const cliente = await Usuario.create({
    nombre: 'Cliente',
    correo: 'cliente.bloques@test.cl',
    passwordHash: 'hash',
    rol: 'cliente',
  });
  await Reserva.create({
    negocioId: negocio._id,
    servicioId: servicio._id,
    clienteId: cliente._id,
    fecha,
    hora: '09:30',
    estado: 'confirmada',
  });

  const response = await request(app)
    .get(`/api/negocios/${negocio.slug}/servicios/${servicio._id}/bloques`)
    .query({ fecha })
    .expect(200);
  assert.deepEqual(response.body.data.bloques, [
    { hora: '09:00', horaFin: '09:30', ocupado: false, seleccionable: true },
    { hora: '09:30', horaFin: '10:00', ocupado: true, seleccionable: false },
    { hora: '10:00', horaFin: '10:30', ocupado: false, seleccionable: true },
    { hora: '10:30', horaFin: '11:00', ocupado: false, seleccionable: true },
  ]);
});

test('rechaza fechas pasadas y devuelve vacío para días sin disponibilidad', async () => {
  const { negocio, servicio } = await fixture();
  await request(app)
    .get(`/api/negocios/${negocio.slug}/servicios/${servicio._id}/bloques`)
    .query({ fecha: '2020-01-01' })
    .expect(400);

  const sunday = new Date();
  sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
  if (sunday.getDay() === 1) {
    sunday.setDate(sunday.getDate() + 6);
  }
  const fecha = sunday.toISOString().slice(0, 10);
  const response = await request(app)
    .get(`/api/negocios/${negocio.slug}/servicios/${servicio._id}/bloques`)
    .query({ fecha })
    .expect(200);
  assert.deepEqual(response.body.data.bloques, []);
});
