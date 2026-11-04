const mongoose = require('mongoose');
const { Disponibilidad, Negocio, Reserva, Servicio, Usuario } = require('../models');
const {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} = require('../errors/app.error');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function ensureObjectId(value, field) {
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError('El identificador no es válido.', [
      { field, message: 'Debe ser un ObjectId válido.' },
    ]);
  }
}

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function parseDate(value) {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    throw new ValidationError('La fecha debe tener el formato AAAA-MM-DD.', [
      { field: 'fecha', message: 'Use el formato AAAA-MM-DD.' },
    ]);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new ValidationError('La fecha no es válida.', [
      { field: 'fecha', message: 'La fecha no existe en el calendario.' },
    ]);
  }
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date < todayStart) {
    throw new ValidationError('No se pueden crear reservas en fechas pasadas.', [
      { field: 'fecha', message: 'La fecha debe ser hoy o una fecha futura.' },
    ]);
  }
  return date;
}

function validateInput(data) {
  const details = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationError('El cuerpo de la petición debe ser un objeto JSON.');
  }
  for (const field of ['negocioId', 'servicioId']) {
    if (typeof data[field] !== 'string' || !mongoose.Types.ObjectId.isValid(data[field])) {
      details.push({ field, message: 'Debe ser un ObjectId válido.' });
    }
  }
  if (typeof data.fecha !== 'string' || !DATE_REGEX.test(data.fecha)) {
    details.push({ field: 'fecha', message: 'Debe tener el formato AAAA-MM-DD.' });
  }
  if (typeof data.hora !== 'string' || !TIME_REGEX.test(data.hora)) {
    details.push({ field: 'hora', message: 'Debe tener el formato HH:mm.' });
  }
  if (
    data.notas !== undefined &&
    (typeof data.notas !== 'string' || data.notas.trim().length > 500)
  ) {
    details.push({
      field: 'notas',
      message: 'Las notas deben ser texto de máximo 500 caracteres.',
    });
  }
  if (details.length > 0) {
    throw new ValidationError('Error de validación de la reserva.', details);
  }
  parseDate(data.fecha);
}

async function crearReserva(clienteId, data) {
  ensureObjectId(clienteId, 'clienteId');
  validateInput(data);
  const fecha = parseDate(data.fecha);

  const [cliente, negocio] = await Promise.all([
    Usuario.findOne({ _id: clienteId, rol: 'cliente' }).select('_id').lean(),
    Negocio.findOne({ _id: data.negocioId, activo: true }).select('_id').lean(),
  ]);
  if (!cliente) {
    throw new ForbiddenError('Solo los clientes pueden crear reservas.');
  }
  if (!negocio) {
    throw new NotFoundError('El negocio solicitado no fue encontrado.');
  }

  const servicio = await Servicio.findOne({
    _id: data.servicioId,
    negocioId: negocio._id,
    activo: true,
  })
    .select('duracionMin')
    .lean();
  if (!servicio) {
    throw new NotFoundError('El servicio solicitado no pertenece a este negocio.');
  }

  const disponibilidad = await Disponibilidad.findOne({
    negocioId: negocio._id,
    servicioId: servicio._id,
    dias: { $in: [fecha.getDay()] },
  })
    .select('dias horaInicio horaFin')
    .lean();
  const start = disponibilidad ? toMinutes(disponibilidad.horaInicio) : null;
  const end = disponibilidad ? toMinutes(disponibilidad.horaFin) : null;
  const selected = toMinutes(data.hora);
  if (
    !disponibilidad ||
    selected < start ||
    selected + servicio.duracionMin > end ||
    (selected - start) % servicio.duracionMin !== 0
  ) {
    throw new ValidationError('La hora seleccionada no está disponible para este servicio.', [
      { field: 'hora', message: 'Debe corresponder a un bloque exacto de la disponibilidad.' },
    ]);
  }

  try {
    const reserva = await Reserva.create({
      negocioId: negocio._id,
      servicioId: servicio._id,
      clienteId: cliente._id,
      fecha: data.fecha,
      hora: data.hora,
      estado: 'confirmada',
      notas: data.notas?.trim() || '',
    });
    return {
      id: reserva._id.toString(),
      negocioId: reserva.negocioId.toString(),
      servicioId: reserva.servicioId.toString(),
      clienteId: reserva.clienteId.toString(),
      fecha: reserva.fecha,
      hora: reserva.hora,
      estado: reserva.estado,
      notas: reserva.notas,
      creadoEn: reserva.creadoEn,
    };
  } catch (error) {
    if (error.code === 11000) {
      throw new ConflictError('El bloque seleccionado ya se encuentra reservado.');
    }
    throw error;
  }
}

async function cancelarReserva(reservaId, auth) {
  ensureObjectId(reservaId, 'reservaId');
  const reserva = await Reserva.findById(reservaId).select('negocioId estado').lean();
  if (!reserva) {
    throw new NotFoundError('La reserva solicitada no fue encontrada.');
  }
  if (auth.rol === 'admin' && auth.negocioId !== reserva.negocioId.toString()) {
    throw new ForbiddenError('No tiene permisos sobre esta reserva.');
  }
  if (!['admin', 'superadmin'].includes(auth.rol)) {
    throw new ForbiddenError('No tiene permisos para cancelar reservas.');
  }
  if (reserva.estado === 'cancelada') {
    return { id: reservaId, estado: 'cancelada' };
  }
  const updated = await Reserva.findByIdAndUpdate(
    reservaId,
    { $set: { estado: 'cancelada' } },
    { returnDocument: 'after' },
  )
    .select('_id estado')
    .lean();
  return { id: updated._id.toString(), estado: updated.estado };
}

module.exports = {
  crearReserva,
  cancelarReserva,
};
