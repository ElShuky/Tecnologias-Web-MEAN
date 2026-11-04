const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const { readConfig } = require('../src/config');
const { Negocio, Servicio, Disponibilidad, Reserva, Usuario } = require('../src/models');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_reservas';

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

function nextDayWithAvailability() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

async function fixture() {
  const date = nextDayWithAvailability();
  const negocio = await Negocio.create({
    nombre: 'Negocio Reservas',
    rubro: 'Salud',
    slug: 'negocio-reservas',
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
    dias: [date.getDay()],
    horaInicio: '09:00',
    horaFin: '11:00',
  });
  const cliente = await Usuario.create({
    nombre: 'Cliente Reserva',
    correo: 'cliente.reserva@test.cl',
    passwordHash: 'hash',
    rol: 'cliente',
  });
  const token = jwt.sign({ sub: cliente._id.toString(), rol: 'cliente' }, readConfig().jwtSecret);
  return {
    negocio,
    servicio,
    cliente,
    token,
    fecha: date.toISOString().slice(0, 10),
  };
}

test('crea una reserva válida usando el cliente del token', async () => {
  const { negocio, servicio, cliente, token, fecha } = await fixture();
  const response = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '09:30',
      notas: 'Preferencia de atención',
    })
    .expect(201);

  assert.equal(response.body.data.estado, 'confirmada');
  assert.equal(response.body.data.clienteId, cliente._id.toString());
  assert.equal(await Reserva.countDocuments({}), 1);
});

test('rechaza una reserva duplicada con 409 y no crea datos adicionales', async () => {
  const { negocio, servicio, token, fecha } = await fixture();
  const body = {
    negocioId: negocio._id.toString(),
    servicioId: servicio._id.toString(),
    fecha,
    hora: '09:30',
  };
  await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(201);
  const response = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(409);

  assert.equal(response.body.error.code, 'CONFLICT');
  assert.equal(await Reserva.countDocuments({}), 1);
});

test('rechaza horas que no corresponden a un bloque disponible', async () => {
  const { negocio, servicio, token, fecha } = await fixture();
  const response = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '09:15',
    })
    .expect(400);

  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.equal(await Reserva.countDocuments({}), 0);
});
