const mongoose = require('mongoose');
const { Disponibilidad, Negocio, Reserva, Servicio } = require('../models');
const { ValidationError, NotFoundError } = require('../errors/app.error');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(date) {
  if (!DATE_REGEX.test(date)) {
    throw new ValidationError('La fecha debe tener el formato AAAA-MM-DD.', [
      { field: 'fecha', message: 'Use el formato AAAA-MM-DD.' },
    ]);
  }
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new ValidationError('La fecha no es válida.', [
      { field: 'fecha', message: 'La fecha no existe en el calendario.' },
    ]);
  }
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (parsed < todayStart) {
    throw new ValidationError('No se pueden consultar fechas pasadas.', [
      { field: 'fecha', message: 'La fecha debe ser hoy o una fecha futura.' },
    ]);
  }
  return parsed;
}

function minutes(time) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function formatTime(totalMinutes) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function dayOfWeek(date) {
  return date.getDay();
}

async function generarBloques(slug, servicioId, fecha) {
  const parsedDate = parseDate(fecha);
  if (!mongoose.Types.ObjectId.isValid(servicioId)) {
    throw new ValidationError('El identificador no es válido.', [
      { field: 'servicioId', message: 'Debe ser un ObjectId válido.' },
    ]);
  }

  const negocio = await Negocio.findOne({ slug: slug.trim().toLowerCase(), activo: true })
    .select('_id')
    .lean();
  if (!negocio) {
    throw new NotFoundError('El negocio solicitado no fue encontrado.');
  }

  const servicio = await Servicio.findOne({
    _id: servicioId,
    negocioId: negocio._id,
    activo: true,
  })
    .select('duracionMin')
    .lean();
  if (!servicio) {
    throw new NotFoundError('El servicio solicitado no fue encontrado.');
  }

  const disponibilidades = await Disponibilidad.find({
    negocioId: negocio._id,
    servicioId,
  })
    .select('dias horaInicio horaFin')
    .lean();
  const disponibilidad = disponibilidades.find((item) =>
    item.dias.some((day) => Number(day) === dayOfWeek(parsedDate)),
  );
  if (!disponibilidad) {
    return { fecha, servicioId, bloques: [] };
  }

  const start = minutes(disponibilidad.horaInicio);
  const end = minutes(disponibilidad.horaFin);
  const duration = servicio.duracionMin;
  const reservations = await Reserva.find({
    negocioId: negocio._id,
    servicioId,
    fecha,
    estado: 'confirmada',
  })
    .select('hora')
    .lean();
  const reservedTimes = new Set(reservations.map((reservation) => reservation.hora));
  const bloques = [];
  for (let current = start; current + duration <= end; current += duration) {
    const hora = formatTime(current);
    const ocupado = reservedTimes.has(hora);
    bloques.push({
      hora,
      horaFin: formatTime(current + duration),
      ocupado,
      seleccionable: !ocupado,
    });
  }

  return { fecha, servicioId, bloques };
}

module.exports = {
  generarBloques,
};
