const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/server');
const { readConfig } = require('../src/config');
const { connectDatabase } = require('../src/database');
const { Negocio, Servicio, Disponibilidad, Reserva, Usuario } = require('../src/models');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_reservas';

before(async () => {
  await connectDatabase(URI);
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
  const admin = await Usuario.create({
    nombre: 'Admin Reserva',
    correo: 'admin.reserva@test.cl',
    passwordHash: 'hash',
    rol: 'admin',
    negocioId: negocio._id,
  });
  const token = jwt.sign({ sub: cliente._id.toString(), rol: 'cliente' }, readConfig().jwtSecret);
  const adminToken = jwt.sign(
    { sub: admin._id.toString(), rol: 'admin', negocioId: negocio._id.toString() },
    readConfig().jwtSecret,
  );
  return {
    negocio,
    servicio,
    cliente,
    token,
    adminToken,
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

test('el cliente consulta solo sus reservas y puede cancelarlas sin borrar el historial', async () => {
  const { negocio, servicio, cliente, token, fecha } = await fixture();
  const reserva = await Reserva.create({
    negocioId: negocio._id,
    servicioId: servicio._id,
    clienteId: cliente._id,
    fecha,
    hora: '09:00',
    estado: 'confirmada',
  });

  const listResponse = await request(app)
    .get('/api/reservas/cliente')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(listResponse.body.data.length, 1);

  await request(app)
    .patch(`/api/reservas/${reserva._id}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.equal(await Reserva.countDocuments({ _id: reserva._id }), 1);
  assert.equal((await Reserva.findById(reserva._id)).estado, 'cancelada');
});

test('el administrador consulta por día y semana únicamente su negocio', async () => {
  const { negocio, servicio, cliente, adminToken, fecha } = await fixture();
  await Reserva.create({
    negocioId: negocio._id,
    servicioId: servicio._id,
    clienteId: cliente._id,
    fecha,
    hora: '09:00',
    estado: 'confirmada',
  });

  const dayResponse = await request(app)
    .get(`/api/gestion/negocios/${negocio._id}/reservas`)
    .query({ fecha })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(dayResponse.body.data.length, 1);

  const weekResponse = await request(app)
    .get(`/api/gestion/negocios/${negocio._id}/reservas`)
    .query({ semana: fecha })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  assert.equal(weekResponse.body.data.length, 1);
});

test('una reserva cancelada libera el bloque para reservar nuevamente', async () => {
  const { negocio, servicio, cliente, token, fecha } = await fixture();
  const reserva = await Reserva.create({
    negocioId: negocio._id,
    servicioId: servicio._id,
    clienteId: cliente._id,
    fecha,
    hora: '10:00',
    estado: 'confirmada',
  });
  await request(app)
    .patch(`/api/reservas/${reserva._id}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const response = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '10:00',
    })
    .expect(201);
  assert.equal(response.body.data.estado, 'confirmada');
  assert.equal(await Reserva.countDocuments({ fecha, hora: '10:00' }), 2);
});

test('guarda una reserva con respuestas válidas (etiqueta y tipo al momento de reservar) y las conserva aunque el formulario cambie después', async () => {
  const { negocio, servicio, token, adminToken, fecha } = await fixture();

  const formRes = await request(app)
    .put(`/api/servicios/${servicio._id}/formulario`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      campos: [
        { etiqueta: 'Motivo breve', tipo: 'texto_corto', obligatorio: true },
        { etiqueta: 'Detalle adicional', tipo: 'texto_largo', obligatorio: false },
        { etiqueta: 'Edad del paciente', tipo: 'numero', obligatorio: true },
        { etiqueta: 'Fecha inicio síntomas', tipo: 'fecha', obligatorio: true },
        { etiqueta: '¿Primera consulta?', tipo: 'si_no', obligatorio: true },
        {
          etiqueta: 'Modalidad preferida',
          tipo: 'seleccion_unica',
          obligatorio: true,
          opciones: ['Presencial', 'Control rápido'],
        },
        {
          etiqueta: 'Áreas a revisar',
          tipo: 'seleccion_multiple',
          obligatorio: false,
          opciones: ['General', 'Preventivo', 'Seguimiento'],
        },
      ],
    })
    .expect(200);

  const campos = formRes.body.data.campos;

  const createRes = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '09:00',
      respuestas: [
        { campoId: campos[0].id, valor: 'Chequeo anual' },
        { campoId: campos[1].id, valor: 'Sin antecedentes previos relevantes.' },
        { campoId: campos[2].id, valor: 29 },
        { campoId: campos[3].id, valor: '2026-10-01' },
        { campoId: campos[4].id, valor: true },
        { campoId: campos[5].id, valor: 'Presencial' },
        { campoId: campos[6].id, valor: ['General', 'Preventivo'] },
      ],
    })
    .expect(201);

  assert.equal(createRes.body.data.respuestas.length, 7);
  assert.deepEqual(createRes.body.data.respuestas[0], {
    campoId: campos[0].id,
    etiqueta: 'Motivo breve',
    tipo: 'texto_corto',
    valor: 'Chequeo anual',
  });
  assert.deepEqual(createRes.body.data.respuestas[4], {
    campoId: campos[4].id,
    etiqueta: '¿Primera consulta?',
    tipo: 'si_no',
    valor: true,
  });

  // Modificamos el formulario del servicio después de creada la reserva
  await request(app)
    .put(`/api/servicios/${servicio._id}/formulario`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      campos: [
        { etiqueta: 'Formulario completamente nuevo', tipo: 'texto_corto', obligatorio: true },
      ],
    })
    .expect(200);

  // La reserva existente conserva sus respuestas originales intactas
  const clientList = await request(app)
    .get('/api/reservas/cliente')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.equal(clientList.body.data.length, 1);
  assert.equal(clientList.body.data[0].respuestas.length, 7);
  assert.equal(clientList.body.data[0].respuestas[0].etiqueta, 'Motivo breve');
  assert.equal(clientList.body.data[0].respuestas[0].tipo, 'texto_corto');
  assert.equal(clientList.body.data[0].respuestas[0].valor, 'Chequeo anual');
});

test('rechaza respuestas inválidas o campos desconocidos con HTTP 400 indicando qué campo falla, sin crear la reserva ni ocupar el bloque', async () => {
  const { negocio, servicio, token, adminToken, fecha } = await fixture();

  const formRes = await request(app)
    .put(`/api/servicios/${servicio._id}/formulario`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      campos: [
        { etiqueta: 'Nombre acompañante', tipo: 'texto_corto', obligatorio: true },
        { etiqueta: 'Observaciones extensas', tipo: 'texto_largo', obligatorio: false },
        { etiqueta: 'Cantidad sesiones', tipo: 'numero', obligatorio: true },
        { etiqueta: 'Fecha control previo', tipo: 'fecha', obligatorio: false },
        { etiqueta: '¿Requiere estacionamiento?', tipo: 'si_no', obligatorio: true },
        {
          etiqueta: 'Sucursal',
          tipo: 'seleccion_unica',
          obligatorio: true,
          opciones: ['Centro', 'Norte'],
        },
        {
          etiqueta: 'Campo desactivado',
          tipo: 'texto_corto',
          obligatorio: false,
          activo: false,
        },
      ],
    })
    .expect(200);

  const [cTextoCorto, cTextoLargo, cNumero, cFecha, cSiNo, cSeleccion, cInactivo] =
    formRes.body.data.campos;

  // 1. Falta campo obligatorio
  const missingReq = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '09:30',
      respuestas: [],
    })
    .expect(400);
  assert.equal(missingReq.body.error.code, 'VALIDATION_ERROR');
  assert.ok(missingReq.body.error.details.some((d) => d.field === cTextoCorto.id));

  // 2. Campo desconocido
  const unknownField = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '09:30',
      respuestas: [
        { campoId: 'campo-inexistente-999', valor: ' intruso ' },
        { campoId: cTextoCorto.id, valor: 'Juan' },
        { campoId: cNumero.id, valor: 2 },
        { campoId: cSiNo.id, valor: false },
        { campoId: cSeleccion.id, valor: 'Centro' },
      ],
    })
    .expect(400);
  assert.ok(unknownField.body.error.details.some((d) => d.field === 'campo-inexistente-999'));

  // 3. Campo inactivo
  const inactiveField = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '09:30',
      respuestas: [
        { campoId: cInactivo.id, valor: 'No debería aceptarse' },
        { campoId: cTextoCorto.id, valor: 'Juan' },
        { campoId: cNumero.id, valor: 2 },
        { campoId: cSiNo.id, valor: false },
        { campoId: cSeleccion.id, valor: 'Centro' },
      ],
    })
    .expect(400);
  assert.ok(inactiveField.body.error.details.some((d) => d.field === cInactivo.id));

  // 4. Exceso de largo máximo (>200 en texto corto, >1000 en texto largo) y tipos inválidos
  const invalidTypesAndLength = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${token}`)
    .send({
      negocioId: negocio._id.toString(),
      servicioId: servicio._id.toString(),
      fecha,
      hora: '09:30',
      respuestas: [
        { campoId: cTextoCorto.id, valor: 'a'.repeat(201) },
        { campoId: cTextoLargo.id, valor: 'b'.repeat(1001) },
        { campoId: cNumero.id, valor: 'no-es-numero' },
        { campoId: cFecha.id, valor: '2026-02-30' },
        { campoId: cSiNo.id, valor: 'quizas' },
        { campoId: cSeleccion.id, valor: 'Sur-No-Permitida' },
      ],
    })
    .expect(400);

  const failedFields = invalidTypesAndLength.body.error.details.map((d) => d.field);
  assert.ok(failedFields.includes(cTextoCorto.id));
  assert.ok(failedFields.includes(cTextoLargo.id));
  assert.ok(failedFields.includes(cNumero.id));
  assert.ok(failedFields.includes(cFecha.id));
  assert.ok(failedFields.includes(cSiNo.id));
  assert.ok(failedFields.includes(cSeleccion.id));

  // Verificamos que NO se creó ninguna reserva y el bloque 09:30 sigue libre
  assert.equal(await Reserva.countDocuments({}), 0);
  const bloquesRes = await request(app)
    .get(`/api/negocios/${negocio.slug}/servicios/${servicio._id}/bloques`)
    .query({ fecha })
    .expect(200);
  const bloque0930 = bloquesRes.body.data.bloques.find((b) => b.hora === '09:30');
  assert.ok(bloque0930);
  assert.equal(bloque0930.ocupado, false);
  assert.equal(bloque0930.seleccionable, true);
});
