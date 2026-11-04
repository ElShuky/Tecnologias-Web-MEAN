const mongoose = require('mongoose');
const { Disponibilidad, Servicio } = require('../models');
const { ValidationError, NotFoundError } = require('../errors/app.error');

const DAY_NAMES = new Map([
  ['domingo', 0],
  ['lunes', 1],
  ['martes', 2],
  ['miercoles', 3],
  ['miércoles', 3],
  ['jueves', 4],
  ['viernes', 5],
  ['sabado', 6],
  ['sábado', 6],
]);
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    return null;
  }
  const normalized = days.map((day) => {
    if (typeof day === 'number' && Number.isInteger(day)) {
      return day;
    }
    if (typeof day === 'string') {
      const value = day.trim().toLowerCase();
      if (/^\d+$/.test(value)) {
        return Number(value);
      }
      return DAY_NAMES.get(value);
    }
    return undefined;
  });
  if (
    normalized.some((day) => day === undefined || day < 0 || day > 6) ||
    new Set(normalized).size !== normalized.length
  ) {
    return null;
  }
  return normalized.sort((a, b) => a - b);
}

function validateInput({ dias, horaInicio, horaFin }) {
  const details = [];
  const normalizedDays = normalizeDays(dias);
  if (!normalizedDays) {
    details.push({
      field: 'dias',
      message: 'Debe indicar días únicos entre 0 y 6 o nombres válidos de la semana.',
    });
  }
  if (typeof horaInicio !== 'string' || !TIME_REGEX.test(horaInicio)) {
    details.push({ field: 'horaInicio', message: 'La hora de inicio debe tener formato HH:mm.' });
  }
  if (typeof horaFin !== 'string' || !TIME_REGEX.test(horaFin)) {
    details.push({ field: 'horaFin', message: 'La hora de fin debe tener formato HH:mm.' });
  }
  if (
    TIME_REGEX.test(horaInicio || '') &&
    TIME_REGEX.test(horaFin || '') &&
    horaFin <= horaInicio
  ) {
    details.push({
      field: 'horaFin',
      message: 'La hora de fin debe ser posterior a la de inicio.',
    });
  }
  if (details.length > 0) {
    throw new ValidationError('Error de validación de disponibilidad.', details);
  }
  return normalizedDays;
}

function ensureId(value, field) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError('El identificador no es válido.', [
      { field, message: 'Debe ser un ObjectId válido.' },
    ]);
  }
}

async function ensureServiceBelongsToBusiness(negocioId, servicioId) {
  ensureId(negocioId, 'negocioId');
  ensureId(servicioId, 'servicioId');
  const service = await Servicio.findOne({ _id: servicioId, negocioId }).select('_id').lean();
  if (!service) {
    throw new NotFoundError('El servicio solicitado no pertenece a este negocio.');
  }
}

function publicAvailability(disponibilidad) {
  return {
    id: disponibilidad._id.toString(),
    servicioId: disponibilidad.servicioId.toString(),
    dias: disponibilidad.dias,
    horaInicio: disponibilidad.horaInicio,
    horaFin: disponibilidad.horaFin,
  };
}

async function consultar(negocioId, servicioId) {
  await ensureServiceBelongsToBusiness(negocioId, servicioId);
  const rows = await Disponibilidad.find({ negocioId, servicioId })
    .select('servicioId dias horaInicio horaFin')
    .sort({ horaInicio: 1 })
    .lean();
  return rows.map(publicAvailability);
}

async function guardar(negocioId, servicioId, data) {
  await ensureServiceBelongsToBusiness(negocioId, servicioId);
  const dias = validateInput(data);
  const disponibilidad = await Disponibilidad.findOneAndUpdate(
    { negocioId, servicioId },
    {
      $set: {
        negocioId,
        servicioId,
        dias,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return publicAvailability(disponibilidad);
}

module.exports = {
  consultar,
  guardar,
};
