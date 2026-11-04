const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Negocio, Usuario, Servicio, Reserva } = require('../src/models');

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_indexes';

before(async () => {
  await mongoose.connect(TEST_MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  // Asegurar que todos los índices estén construidos en la base de datos
  await Negocio.syncIndexes();
  await Usuario.syncIndexes();
  await Servicio.syncIndexes();
  await Reserva.syncIndexes();
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

beforeEach(async () => {
  // Limpiar colecciones antes de cada prueba para garantizar independencia
  await Reserva.deleteMany({});
  await Servicio.deleteMany({});
  await Usuario.deleteMany({});
  await Negocio.deleteMany({});
});

test('Índice único en reservas confirmadas existe en MongoDB con partialFilterExpression', async () => {
  const indexes = await Reserva.collection.indexes();
  const indexCompuesto = indexes.find(
    (idx) =>
      idx.key.negocioId === 1 &&
      idx.key.servicioId === 1 &&
      idx.key.fecha === 1 &&
      idx.key.hora === 1,
  );

  assert.ok(indexCompuesto, 'El índice compuesto debe existir en la colección reservas.');
  assert.equal(indexCompuesto.unique, true, 'El índice compuesto debe ser único.');
  assert.deepEqual(
    indexCompuesto.partialFilterExpression,
    { estado: 'confirmada' },
    'El índice debe aplicar exclusivamente a reservas con estado confirmada.',
  );
});

test('Índices de agenda por negocio y fecha, reservas por cliente y servicios activos por negocio existen en MongoDB', async () => {
  const reservaIndexes = await Reserva.collection.indexes();
  const servicioIndexes = await Servicio.collection.indexes();

  const idxAgendaNegocio = reservaIndexes.find(
    (idx) => idx.key.negocioId === 1 && idx.key.fecha === 1 && Object.keys(idx.key).length === 2,
  );
  assert.ok(idxAgendaNegocio, 'Debe existir el índice { negocioId: 1, fecha: 1 } en reservas.');

  const idxHistorialCliente = reservaIndexes.find(
    (idx) => idx.key.clienteId === 1 && idx.key.fecha === 1 && Object.keys(idx.key).length === 2,
  );
  assert.ok(idxHistorialCliente, 'Debe existir el índice { clienteId: 1, fecha: 1 } en reservas.');

  const idxServiciosActivos = servicioIndexes.find(
    (idx) => idx.key.negocioId === 1 && idx.key.activo === 1,
  );
  assert.ok(
    idxServiciosActivos,
    'Debe existir el índice { negocioId: 1, activo: 1 } en servicios.',
  );
});

test('Índices únicos en correo de usuario y slug de negocio existen y rechazan duplicados', async () => {
  const usuarioIndexes = await Usuario.collection.indexes();
  const negocioIndexes = await Negocio.collection.indexes();

  const idxCorreo = usuarioIndexes.find((idx) => idx.key.correo === 1);
  assert.ok(idxCorreo && idxCorreo.unique, 'El índice de correo debe ser único en usuarios.');

  const idxSlug = negocioIndexes.find((idx) => idx.key.slug === 1);
  assert.ok(idxSlug && idxSlug.unique, 'El índice de slug debe ser único en negocios.');

  // Prueba de duplicado en Usuario
  await Usuario.create({
    nombre: 'Usuario 1',
    correo: 'duplicado@correo.com',
    passwordHash: 'hash1',
    rol: 'cliente',
  });

  await assert.rejects(
    async () => {
      await Usuario.create({
        nombre: 'Usuario 2',
        correo: 'duplicado@correo.com',
        passwordHash: 'hash2',
        rol: 'cliente',
      });
    },
    (err) => err.code === 11000,
    'MongoDB debe rechazar un usuario con correo duplicado con código 11000.',
  );

  // Prueba de duplicado en Negocio
  await Negocio.create({
    nombre: 'Negocio Uno',
    rubro: 'Barbería',
    slug: 'mi-negocio-unico',
  });

  await assert.rejects(
    async () => {
      await Negocio.create({
        nombre: 'Negocio Dos',
        rubro: 'Salud',
        slug: 'mi-negocio-unico',
      });
    },
    (err) => err.code === 11000,
    'MongoDB debe rechazar un negocio con slug duplicado con código 11000.',
  );
});

test('La base de datos rechaza una reserva confirmada duplicada en el mismo bloque horario', async () => {
  const negocioId = new mongoose.Types.ObjectId();
  const servicioId = new mongoose.Types.ObjectId();
  const cliente1Id = new mongoose.Types.ObjectId();
  const cliente2Id = new mongoose.Types.ObjectId();
  const fecha = '2026-11-20';
  const hora = '10:00';

  // Primera reserva confirmada: se guarda con éxito
  const primeraReserva = await Reserva.create({
    negocioId,
    servicioId,
    clienteId: cliente1Id,
    fecha,
    hora,
    estado: 'confirmada',
  });
  assert.ok(primeraReserva._id);

  // Segunda reserva para el mismo negocio, servicio, fecha y hora: rechazada por MongoDB
  await assert.rejects(
    async () => {
      await Reserva.create({
        negocioId,
        servicioId,
        clienteId: cliente2Id,
        fecha,
        hora,
        estado: 'confirmada',
      });
    },
    (err) => err.code === 11000,
    'MongoDB debe rechazar la reserva duplicada con error E11000.',
  );

  const total = await Reserva.countDocuments({ negocioId, servicioId, fecha, hora });
  assert.equal(total, 1, 'Solo debe existir exactamente una reserva en la base de datos.');
});

test('CRITERIO DE TERMINADO: Dos solicitudes simultáneas no pueden confirmar el mismo bloque de un servicio', async () => {
  const negocioId = new mongoose.Types.ObjectId();
  const servicioId = new mongoose.Types.ObjectId();
  const cliente1Id = new mongoose.Types.ObjectId();
  const cliente2Id = new mongoose.Types.ObjectId();
  const fecha = '2026-11-25';
  const hora = '15:00';

  // Dos clientes envían la confirmación de la reserva al mismo milisegundo (concurrencia)
  const [resultado1, resultado2] = await Promise.allSettled([
    Reserva.create({
      negocioId,
      servicioId,
      clienteId: cliente1Id,
      fecha,
      hora,
      estado: 'confirmada',
    }),
    Reserva.create({
      negocioId,
      servicioId,
      clienteId: cliente2Id,
      fecha,
      hora,
      estado: 'confirmada',
    }),
  ]);

  const exitosos = [resultado1, resultado2].filter((res) => res.status === 'fulfilled');
  const rechazados = [resultado1, resultado2].filter((res) => res.status === 'rejected');

  assert.equal(
    exitosos.length,
    1,
    'Exactamente una sola solicitud debe ser confirmada exitosamente.',
  );
  assert.equal(
    rechazados.length,
    1,
    'La solicitud colisionante debe ser rechazada inmediatamente por la base de datos.',
  );
  assert.equal(
    rechazados[0].reason.code,
    11000,
    'El error de la solicitud rechazada debe ser de clave duplicada (E11000).',
  );

  const totalEnBaseDeDatos = await Reserva.countDocuments({
    negocioId,
    servicioId,
    fecha,
    hora,
    estado: 'confirmada',
  });
  assert.equal(
    totalEnBaseDeDatos,
    1,
    'La base de datos debe contener exactamente 1 reserva confirmada, impidiendo físicamente el doble cupo.',
  );
});

test('Permite volver a reservar un bloque si la reserva previa fue cancelada', async () => {
  const negocioId = new mongoose.Types.ObjectId();
  const servicioId = new mongoose.Types.ObjectId();
  const cliente1Id = new mongoose.Types.ObjectId();
  const cliente2Id = new mongoose.Types.ObjectId();
  const fecha = '2026-11-26';
  const hora = '11:00';

  // Cliente 1 reserva el bloque
  const reserva1 = await Reserva.create({
    negocioId,
    servicioId,
    clienteId: cliente1Id,
    fecha,
    hora,
    estado: 'confirmada',
  });

  // Cliente 1 cancela la reserva
  reserva1.estado = 'cancelada';
  await reserva1.save();

  // Cliente 2 ahora puede reservar el mismo bloque sin conflicto
  const reserva2 = await Reserva.create({
    negocioId,
    servicioId,
    clienteId: cliente2Id,
    fecha,
    hora,
    estado: 'confirmada',
  });
  assert.ok(reserva2._id);

  const confirmadas = await Reserva.countDocuments({
    negocioId,
    servicioId,
    fecha,
    hora,
    estado: 'confirmada',
  });
  assert.equal(confirmadas, 1);

  const totalHistorial = await Reserva.countDocuments({
    negocioId,
    servicioId,
    fecha,
    hora,
  });
  assert.equal(
    totalHistorial,
    2,
    'Existen 2 documentos: 1 cancelada histórica y 1 confirmada activa.',
  );
});

test('Aislamiento multi-empresa: dos negocios distintos pueden agendar en la misma fecha y hora sin interferir', async () => {
  const negocioA = new mongoose.Types.ObjectId();
  const negocioB = new mongoose.Types.ObjectId();
  const servicioA = new mongoose.Types.ObjectId();
  const servicioB = new mongoose.Types.ObjectId();
  const clienteA = new mongoose.Types.ObjectId();
  const clienteB = new mongoose.Types.ObjectId();
  const fecha = '2026-11-27';
  const hora = '09:00';

  // Dos negocios distintos reservan a la misma hora en la misma fecha
  const [resA, resB] = await Promise.all([
    Reserva.create({
      negocioId: negocioA,
      servicioId: servicioA,
      clienteId: clienteA,
      fecha,
      hora,
      estado: 'confirmada',
    }),
    Reserva.create({
      negocioId: negocioB,
      servicioId: servicioB,
      clienteId: clienteB,
      fecha,
      hora,
      estado: 'confirmada',
    }),
  ]);

  assert.ok(resA._id);
  assert.ok(resB._id);
  assert.notEqual(resA.negocioId.toString(), resB.negocioId.toString());
});
