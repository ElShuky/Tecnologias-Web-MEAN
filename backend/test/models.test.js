const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Verificación de importación individual y centralizada
const NegocioDirecto = require('../src/models/negocio.model');
const UsuarioDirecto = require('../src/models/usuario.model');
const ServicioDirecto = require('../src/models/servicio.model');
const DisponibilidadDirecto = require('../src/models/disponibilidad.model');
const ReservaDirecto = require('../src/models/reserva.model');
const SeguimientoDirecto = require('../src/models/seguimiento.model');

const {
  Negocio,
  Usuario,
  Servicio,
  Disponibilidad,
  Reserva,
  Seguimiento,
} = require('../src/models');

test('Los modelos se pueden importar tanto individualmente como desde models/index.js', () => {
  assert.equal(Negocio, NegocioDirecto);
  assert.equal(Usuario, UsuarioDirecto);
  assert.equal(Servicio, ServicioDirecto);
  assert.equal(Disponibilidad, DisponibilidadDirecto);
  assert.equal(Reserva, ReservaDirecto);
  assert.equal(Seguimiento, SeguimientoDirecto);

  assert.equal(typeof Negocio, 'function');
  assert.equal(typeof Usuario, 'function');
  assert.equal(typeof Servicio, 'function');
  assert.equal(typeof Disponibilidad, 'function');
  assert.equal(typeof Reserva, 'function');
  assert.equal(typeof Seguimiento, 'function');

  assert.equal(Negocio.modelName, 'Negocio');
  assert.equal(Usuario.modelName, 'Usuario');
  assert.equal(Servicio.modelName, 'Servicio');
  assert.equal(Disponibilidad.modelName, 'Disponibilidad');
  assert.equal(Reserva.modelName, 'Reserva');
  assert.equal(Seguimiento.modelName, 'Seguimiento');
});

test('Las referencias entre entidades están correctamente configuradas', () => {
  assert.equal(Usuario.schema.path('negocioId').options.ref, 'Negocio');

  assert.equal(Servicio.schema.path('negocioId').options.ref, 'Negocio');

  assert.equal(Disponibilidad.schema.path('negocioId').options.ref, 'Negocio');
  assert.equal(Disponibilidad.schema.path('servicioId').options.ref, 'Servicio');

  assert.equal(Reserva.schema.path('negocioId').options.ref, 'Negocio');
  assert.equal(Reserva.schema.path('servicioId').options.ref, 'Servicio');
  assert.equal(Reserva.schema.path('clienteId').options.ref, 'Usuario');

  assert.equal(Seguimiento.schema.path('clienteId').options.ref, 'Usuario');
  assert.equal(Seguimiento.schema.path('negocioId').options.ref, 'Negocio');
});

test('Todos los modelos configuran timestamps mapeados a creadoEn y actualizadoEn', () => {
  const modelos = [Negocio, Usuario, Servicio, Disponibilidad, Reserva, Seguimiento];
  for (const modelo of modelos) {
    const timestamps = modelo.schema.options.timestamps;
    assert.ok(timestamps, `El modelo ${modelo.modelName} debe definir timestamps.`);
    assert.equal(timestamps.createdAt, 'creadoEn');
    assert.equal(timestamps.updatedAt, 'actualizadoEn');
  }
});

// ==========================================
// PRUEBAS DE VALIDACIÓN: NEGOCIO
// ==========================================
test('Negocio valida exitosamente con datos correctos', async () => {
  const negocio = new Negocio({
    nombre: 'Barbería Central',
    rubro: 'Barbería',
    slug: 'barberia-central',
    descripcion: 'Atención personalizada de corte y barba.',
  });

  await assert.doesNotReject(negocio.validate());
  assert.equal(negocio.activo, true);
  assert.equal(negocio.slug, 'barberia-central');
});

test('Negocio falla si faltan campos obligatorios o el slug es inválido', async () => {
  const negocioVacio = new Negocio({});
  const errorVacio = await negocioVacio.validate().catch((err) => err);
  assert.ok(errorVacio.errors.nombre);
  assert.ok(errorVacio.errors.rubro);
  assert.ok(errorVacio.errors.slug);

  const negocioSlugInvalido = new Negocio({
    nombre: 'Local',
    rubro: 'Varios',
    slug: 'Slug con Mayúsculas y Espacios!',
  });
  const errorSlug = await negocioSlugInvalido.validate().catch((err) => err);
  assert.ok(errorSlug.errors.slug);

  const negocioNombreCorto = new Negocio({
    nombre: 'A',
    rubro: 'Comercio',
    slug: 'local-a',
  });
  const errorNombre = await negocioNombreCorto.validate().catch((err) => err);
  assert.ok(errorNombre.errors.nombre);
});

// ==========================================
// PRUEBAS DE VALIDACIÓN: USUARIO
// ==========================================
test('Usuario cliente valida exitosamente sin negocioId', async () => {
  const cliente = new Usuario({
    nombre: 'Carlos Silva',
    correo: 'carlos.silva@gmail.com',
    passwordHash: '$2b$10$hashedpasswordstringsample123',
    rol: 'cliente',
  });

  await assert.doesNotReject(cliente.validate());
  assert.equal(cliente.negocioId, null);
  assert.equal(cliente.rol, 'cliente');
});

test('Usuario admin valida exitosamente con negocioId válido', async () => {
  const admin = new Usuario({
    nombre: 'Ana Administradora',
    correo: 'admin@barberia.cl',
    passwordHash: '$2b$10$hashedpasswordstringsample456',
    rol: 'admin',
    negocioId: new mongoose.Types.ObjectId(),
  });

  await assert.doesNotReject(admin.validate());
  assert.equal(admin.rol, 'admin');
  assert.ok(admin.negocioId);
});

test('Usuario falla si faltan campos, correo es inválido o rol no está permitido', async () => {
  const usuarioVacio = new Usuario({});
  const errorVacio = await usuarioVacio.validate().catch((err) => err);
  assert.ok(errorVacio.errors.nombre);
  assert.ok(errorVacio.errors.correo);
  assert.ok(errorVacio.errors.passwordHash);

  const usuarioCorreoInvalido = new Usuario({
    nombre: 'Juan',
    correo: 'correo-sin-formato',
    passwordHash: 'hash',
  });
  const errorCorreo = await usuarioCorreoInvalido.validate().catch((err) => err);
  assert.ok(errorCorreo.errors.correo);

  const usuarioRolInvalido = new Usuario({
    nombre: 'Pedro',
    correo: 'pedro@correo.com',
    passwordHash: 'hash',
    rol: 'rol-invalido',
  });
  const errorRol = await usuarioRolInvalido.validate().catch((err) => err);
  assert.ok(errorRol.errors.rol);
});

test('Usuario admin exige negocioId y cliente o superadmin rechazan negocioId asignado', async () => {
  const adminSinNegocio = new Usuario({
    nombre: 'Admin Sin Negocio',
    correo: 'admin.sin@empresa.cl',
    passwordHash: 'hash123',
    rol: 'admin',
  });
  const errorAdmin = await adminSinNegocio.validate().catch((err) => err);
  assert.ok(errorAdmin.errors.negocioId);

  const clienteConNegocio = new Usuario({
    nombre: 'Cliente Con Negocio',
    correo: 'cliente.con@empresa.cl',
    passwordHash: 'hash123',
    rol: 'cliente',
    negocioId: new mongoose.Types.ObjectId(),
  });
  const errorCliente = await clienteConNegocio.validate().catch((err) => err);
  assert.ok(errorCliente.errors.negocioId);

  const superadminConNegocio = new Usuario({
    nombre: 'Superadmin Con Negocio',
    correo: 'superadmin.con@empresa.cl',
    passwordHash: 'hash123',
    rol: 'superadmin',
    negocioId: new mongoose.Types.ObjectId(),
  });
  const errorSuperadmin = await superadminConNegocio.validate().catch((err) => err);
  assert.ok(errorSuperadmin.errors.negocioId);
});

// ==========================================
// PRUEBAS DE VALIDACIÓN: SERVICIO
// ==========================================
test('Servicio valida exitosamente con datos correctos', async () => {
  const servicio = new Servicio({
    negocioId: new mongoose.Types.ObjectId(),
    nombre: 'Corte de Cabello',
    duracionMin: 30,
    precio: 8000,
    descripcion: 'Corte clásico con lavado incluido.',
  });

  await assert.doesNotReject(servicio.validate());
  assert.equal(servicio.activo, true);
});

test('Servicio falla con valores negativos, duración no entera o datos ausentes', async () => {
  const servicioVacio = new Servicio({});
  const errorVacio = await servicioVacio.validate().catch((err) => err);
  assert.ok(errorVacio.errors.negocioId);
  assert.ok(errorVacio.errors.nombre);
  assert.ok(errorVacio.errors.duracionMin);
  assert.ok(errorVacio.errors.precio);

  const servicioDuracionInvalida = new Servicio({
    negocioId: new mongoose.Types.ObjectId(),
    nombre: 'Corte',
    duracionMin: 30.5,
    precio: 5000,
  });
  const errorDuracion = await servicioDuracionInvalida.validate().catch((err) => err);
  assert.ok(errorDuracion.errors.duracionMin);

  const servicioPrecioNegativo = new Servicio({
    negocioId: new mongoose.Types.ObjectId(),
    nombre: 'Corte',
    duracionMin: 30,
    precio: -100,
  });
  const errorPrecio = await servicioPrecioNegativo.validate().catch((err) => err);
  assert.ok(errorPrecio.errors.precio);
});

// ==========================================
// PRUEBAS DE VALIDACIÓN: DISPONIBILIDAD
// ==========================================
test('Disponibilidad valida exitosamente con días numéricos o textuales y horarios válidos', async () => {
  const dispNumerica = new Disponibilidad({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    dias: [1, 2, 3, 4, 5],
    horaInicio: '09:00',
    horaFin: '18:00',
  });
  await assert.doesNotReject(dispNumerica.validate());

  const dispTexto = new Disponibilidad({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    dias: ['lunes', 'miércoles', 'viernes'],
    horaInicio: '10:00',
    horaFin: '14:30',
  });
  await assert.doesNotReject(dispTexto.validate());
});

test('Disponibilidad falla si faltan campos, días son vacíos/inválidos o fin <= inicio', async () => {
  const dispVacia = new Disponibilidad({});
  const errorVacio = await dispVacia.validate().catch((err) => err);
  assert.ok(errorVacio.errors.negocioId);
  assert.ok(errorVacio.errors.servicioId);
  assert.ok(errorVacio.errors.dias);
  assert.ok(errorVacio.errors.horaInicio);
  assert.ok(errorVacio.errors.horaFin);

  const dispDiasVacios = new Disponibilidad({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    dias: [],
    horaInicio: '09:00',
    horaFin: '17:00',
  });
  const errorDias = await dispDiasVacios.validate().catch((err) => err);
  assert.ok(errorDias.errors.dias);

  const dispDiasInvalidos = new Disponibilidad({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    dias: ['dia-inventado', 99],
    horaInicio: '09:00',
    horaFin: '17:00',
  });
  const errorDiasInv = await dispDiasInvalidos.validate().catch((err) => err);
  assert.ok(errorDiasInv.errors.dias);

  const dispHorarioInvertido = new Disponibilidad({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    dias: [1, 2, 3],
    horaInicio: '18:00',
    horaFin: '09:00',
  });
  const errorHorario = await dispHorarioInvertido.validate().catch((err) => err);
  assert.ok(errorHorario.errors.horaFin);

  const dispFormatoHoraInvalido = new Disponibilidad({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    dias: [1],
    horaInicio: '9:00',
    horaFin: '25:00',
  });
  const errorFormato = await dispFormatoHoraInvalido.validate().catch((err) => err);
  assert.ok(errorFormato.errors.horaInicio);
  assert.ok(errorFormato.errors.horaFin);
});

// ==========================================
// PRUEBAS DE VALIDACIÓN: RESERVA
// ==========================================
test('Reserva valida exitosamente con datos correctos y asigna confirmada por defecto', async () => {
  const reserva = new Reserva({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    clienteId: new mongoose.Types.ObjectId(),
    fecha: '2026-11-20',
    hora: '10:30',
    notas: 'Primera atención, cliente nuevo.',
  });

  await assert.doesNotReject(reserva.validate());
  assert.equal(reserva.estado, 'confirmada');
  assert.equal(reserva.notas, 'Primera atención, cliente nuevo.');
});

test('Reserva acepta estado cancelada', async () => {
  const reservaCancelada = new Reserva({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    clienteId: new mongoose.Types.ObjectId(),
    fecha: '2026-11-20',
    hora: '11:00',
    estado: 'cancelada',
  });

  await assert.doesNotReject(reservaCancelada.validate());
  assert.equal(reservaCancelada.estado, 'cancelada');
});

test('Reserva falla si faltan campos o con fecha/hora/estado inválidos', async () => {
  const reservaVacia = new Reserva({});
  const errorVacio = await reservaVacia.validate().catch((err) => err);
  assert.ok(errorVacio.errors.negocioId);
  assert.ok(errorVacio.errors.servicioId);
  assert.ok(errorVacio.errors.clienteId);
  assert.ok(errorVacio.errors.fecha);
  assert.ok(errorVacio.errors.hora);

  const reservaFechaFormato = new Reserva({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    clienteId: new mongoose.Types.ObjectId(),
    fecha: '20-11-2026',
    hora: '10:00',
  });
  const errorFecha = await reservaFechaFormato.validate().catch((err) => err);
  assert.ok(errorFecha.errors.fecha);

  const reservaFechaInexistente = new Reserva({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    clienteId: new mongoose.Types.ObjectId(),
    fecha: '2026-02-30',
    hora: '10:00',
  });
  const errorFechaInexistente = await reservaFechaInexistente.validate().catch((err) => err);
  assert.ok(errorFechaInexistente.errors.fecha);

  const reservaHoraInvalida = new Reserva({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    clienteId: new mongoose.Types.ObjectId(),
    fecha: '2026-11-20',
    hora: '25:70',
  });
  const errorHora = await reservaHoraInvalida.validate().catch((err) => err);
  assert.ok(errorHora.errors.hora);

  const reservaEstadoInvalido = new Reserva({
    negocioId: new mongoose.Types.ObjectId(),
    servicioId: new mongoose.Types.ObjectId(),
    clienteId: new mongoose.Types.ObjectId(),
    fecha: '2026-11-20',
    hora: '10:00',
    estado: 'pendiente',
  });
  const errorEstado = await reservaEstadoInvalido.validate().catch((err) => err);
  assert.ok(errorEstado.errors.estado);
});

test('Reserva define el índice compuesto único con filtro parcial para confirmadas (RF-12, RNF-03)', () => {
  const indexes = Reserva.schema.indexes();

  // Debe existir un índice compuesto único sobre { negocioId, servicioId, fecha, hora } con partialFilterExpression
  const indiceDobleCupo = indexes.find(
    ([fields, options]) =>
      fields.negocioId === 1 &&
      fields.servicioId === 1 &&
      fields.fecha === 1 &&
      fields.hora === 1 &&
      options?.unique === true,
  );

  assert.ok(indiceDobleCupo, 'Debe existir el índice compuesto único para evitar doble reserva.');
  assert.deepEqual(
    indiceDobleCupo[1].partialFilterExpression,
    { estado: 'confirmada' },
    'El índice único debe aplicar solo a reservas en estado confirmada para permitir re-reserva si se cancela.',
  );

  // Índices para consultas de agenda
  const indiceNegocioFecha = indexes.find(
    ([fields]) => fields.negocioId === 1 && fields.fecha === 1 && Object.keys(fields).length === 2,
  );
  assert.ok(indiceNegocioFecha, 'Debe existir el índice { negocioId: 1, fecha: 1 }');

  const indiceClienteFecha = indexes.find(
    ([fields]) => fields.clienteId === 1 && fields.fecha === 1 && Object.keys(fields).length === 2,
  );
  assert.ok(indiceClienteFecha, 'Debe existir el índice { clienteId: 1, fecha: 1 }');
});
