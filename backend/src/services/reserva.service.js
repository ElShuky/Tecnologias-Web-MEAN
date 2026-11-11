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
const SHORT_TEXT_MAX_LENGTH = 200;
const LONG_TEXT_MAX_LENGTH = 1000;

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

function parseCalendarDate(value, field = 'fecha') {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
    throw new ValidationError('La fecha debe tener el formato AAAA-MM-DD.', [
      { field, message: 'Use el formato AAAA-MM-DD.' },
    ]);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new ValidationError('La fecha no es válida.', [
      { field, message: 'La fecha no existe en el calendario.' },
    ]);
  }
  return date;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function reservationData(reserva) {
  const negocioId = reserva.negocioId?._id || reserva.negocioId;
  const servicioId = reserva.servicioId?._id || reserva.servicioId;
  const clienteId = reserva.clienteId?._id || reserva.clienteId;
  return {
    id: reserva._id.toString(),
    negocioId: negocioId.toString(),
    servicioId: servicioId.toString(),
    clienteId: clienteId.toString(),
    negocioNombre: reserva.negocioId?.nombre,
    servicioNombre: reserva.servicioId?.nombre,
    clienteNombre: reserva.clienteId?.nombre,
    clienteCorreo: reserva.clienteId?.correo,
    fecha: reserva.fecha,
    hora: reserva.hora,
    estado: reserva.estado,
    notas: reserva.notas,
    respuestas: (reserva.respuestas || []).map((item) => ({
      campoId: item.campoId,
      etiqueta: item.etiqueta,
      tipo: item.tipo,
      valor: item.valor,
    })),
    creadoEn: reserva.creadoEn,
    actualizadoEn: reserva.actualizadoEn,
  };
}

function isValidCalendarDateString(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!DATE_REGEX.test(trimmed)) {
    return false;
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isEmptyAnswerValue(valor) {
  if (valor === undefined || valor === null) {
    return true;
  }
  if (typeof valor === 'string' && valor.trim() === '') {
    return true;
  }
  if (Array.isArray(valor) && valor.length === 0) {
    return true;
  }
  return false;
}

function validateRespuestas(formulario = [], rawRespuestas = undefined) {
  if (rawRespuestas !== undefined && rawRespuestas !== null && !Array.isArray(rawRespuestas)) {
    throw new ValidationError('Las respuestas deben enviarse como un arreglo.', [
      { field: 'respuestas', message: 'El campo respuestas debe ser un arreglo.' },
    ]);
  }

  const respuestasInput = Array.isArray(rawRespuestas) ? rawRespuestas : [];
  const todosLosCampos = Array.isArray(formulario) ? formulario : [];
  const camposActivos = todosLosCampos
    .filter((campo) => campo.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  const activosMap = new Map(camposActivos.map((campo) => [campo.id, campo]));
  const inactivosMap = new Map(
    todosLosCampos.filter((campo) => campo.activo === false).map((campo) => [campo.id, campo]),
  );

  const details = [];
  const providedById = new Map();

  respuestasInput.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      details.push({
        field: `respuestas[${index}]`,
        message: 'Cada respuesta debe ser un objeto con campoId y valor.',
      });
      return;
    }

    const campoId = typeof item.campoId === 'string' ? item.campoId.trim() : '';
    if (!campoId) {
      details.push({
        field: `respuestas[${index}].campoId`,
        message: 'Cada respuesta debe indicar un campoId válido.',
      });
      return;
    }

    if (providedById.has(campoId)) {
      details.push({
        field: campoId,
        campoId,
        message: `El campo "${campoId}" fue enviado más de una vez.`,
      });
      return;
    }

    if (!activosMap.has(campoId)) {
      if (inactivosMap.has(campoId)) {
        const inactivo = inactivosMap.get(campoId);
        details.push({
          field: campoId,
          campoId,
          etiqueta: inactivo.etiqueta,
          message: `El campo "${inactivo.etiqueta}" (${campoId}) no se encuentra activo.`,
        });
      } else {
        details.push({
          field: campoId,
          campoId,
          message: `El campo "${campoId}" no existe en el formulario del servicio.`,
        });
      }
      return;
    }

    providedById.set(campoId, item.valor);
  });

  const normalizedRespuestas = [];

  for (const campo of camposActivos) {
    const hasEntry = providedById.has(campo.id);
    const rawVal = hasEntry ? providedById.get(campo.id) : undefined;

    if (!hasEntry || isEmptyAnswerValue(rawVal)) {
      if (campo.obligatorio) {
        details.push({
          field: campo.id,
          campoId: campo.id,
          etiqueta: campo.etiqueta,
          message: `El campo obligatorio "${campo.etiqueta}" (${campo.id}) es requerido.`,
        });
      }
      continue;
    }

    let normalizedVal;

    switch (campo.tipo) {
      case 'texto_corto': {
        if (
          typeof rawVal !== 'string' ||
          rawVal.length > SHORT_TEXT_MAX_LENGTH ||
          rawVal.trim().length > SHORT_TEXT_MAX_LENGTH
        ) {
          details.push({
            field: campo.id,
            campoId: campo.id,
            etiqueta: campo.etiqueta,
            message: `El campo "${campo.etiqueta}" (${campo.id}) debe ser texto corto de máximo ${SHORT_TEXT_MAX_LENGTH} caracteres.`,
          });
        } else {
          normalizedVal = rawVal.trim();
        }
        break;
      }
      case 'texto_largo': {
        if (
          typeof rawVal !== 'string' ||
          rawVal.length > LONG_TEXT_MAX_LENGTH ||
          rawVal.trim().length > LONG_TEXT_MAX_LENGTH
        ) {
          details.push({
            field: campo.id,
            campoId: campo.id,
            etiqueta: campo.etiqueta,
            message: `El campo "${campo.etiqueta}" (${campo.id}) debe ser texto largo de máximo ${LONG_TEXT_MAX_LENGTH} caracteres.`,
          });
        } else {
          normalizedVal = rawVal.trim();
        }
        break;
      }
      case 'numero': {
        if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) {
          details.push({
            field: campo.id,
            campoId: campo.id,
            etiqueta: campo.etiqueta,
            message: `El campo "${campo.etiqueta}" (${campo.id}) debe ser un número válido.`,
          });
        } else {
          normalizedVal = rawVal;
        }
        break;
      }
      case 'fecha': {
        if (!isValidCalendarDateString(rawVal)) {
          details.push({
            field: campo.id,
            campoId: campo.id,
            etiqueta: campo.etiqueta,
            message: `El campo "${campo.etiqueta}" (${campo.id}) debe ser una fecha válida (AAAA-MM-DD).`,
          });
        } else {
          normalizedVal = rawVal.trim();
        }
        break;
      }
      case 'si_no': {
        if (typeof rawVal === 'boolean') {
          normalizedVal = rawVal;
        } else if (
          typeof rawVal === 'string' &&
          ['si', 'sí', 'no'].includes(rawVal.trim().toLowerCase())
        ) {
          normalizedVal = rawVal.trim().toLowerCase() !== 'no';
        } else {
          details.push({
            field: campo.id,
            campoId: campo.id,
            etiqueta: campo.etiqueta,
            message: `El campo "${campo.etiqueta}" (${campo.id}) debe tener un valor sí/no (booleano).`,
          });
        }
        break;
      }
      case 'seleccion_unica': {
        const opciones = Array.isArray(campo.opciones) ? campo.opciones : [];
        if (typeof rawVal !== 'string' || !opciones.includes(rawVal.trim())) {
          details.push({
            field: campo.id,
            campoId: campo.id,
            etiqueta: campo.etiqueta,
            message: `El campo "${campo.etiqueta}" (${campo.id}) debe corresponder a una opción permitida.`,
          });
        } else {
          normalizedVal = rawVal.trim();
        }
        break;
      }
      case 'seleccion_multiple': {
        const opciones = Array.isArray(campo.opciones) ? campo.opciones : [];
        if (
          !Array.isArray(rawVal) ||
          rawVal.length === 0 ||
          rawVal.some((opt) => typeof opt !== 'string' || !opciones.includes(opt.trim()))
        ) {
          details.push({
            field: campo.id,
            campoId: campo.id,
            etiqueta: campo.etiqueta,
            message: `El campo "${campo.etiqueta}" (${campo.id}) debe incluir solo opciones permitidas.`,
          });
        } else {
          const cleanOptions = rawVal.map((opt) => opt.trim());
          if (new Set(cleanOptions).size !== cleanOptions.length) {
            details.push({
              field: campo.id,
              campoId: campo.id,
              etiqueta: campo.etiqueta,
              message: `El campo "${campo.etiqueta}" (${campo.id}) no admite opciones repetidas.`,
            });
          } else {
            normalizedVal = cleanOptions;
          }
        }
        break;
      }
      default:
        break;
    }

    if (normalizedVal !== undefined) {
      normalizedRespuestas.push({
        campoId: campo.id,
        etiqueta: campo.etiqueta,
        tipo: campo.tipo,
        valor: normalizedVal,
      });
    }
  }

  if (details.length > 0) {
    throw new ValidationError(details[0].message, details);
  }

  return normalizedRespuestas;
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
    .select('duracionMin formulario')
    .lean();
  if (!servicio) {
    throw new NotFoundError('El servicio solicitado no pertenece a este negocio.');
  }

  const respuestas = validateRespuestas(servicio.formulario || [], data.respuestas);

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
      respuestas,
    });
    return reservationData(reserva);
  } catch (error) {
    if (error.code === 11000) {
      throw new ConflictError('El bloque seleccionado ya se encuentra reservado.');
    }
    throw error;
  }
}

async function cancelarReserva(reservaId, auth) {
  ensureObjectId(reservaId, 'reservaId');
  const reserva = await Reserva.findById(reservaId).select('negocioId clienteId estado').lean();
  if (!reserva) {
    throw new NotFoundError('La reserva solicitada no fue encontrada.');
  }
  const isOwner = auth.rol === 'cliente' && auth.sub === reserva.clienteId.toString();
  const isBusinessAdmin =
    auth.rol === 'superadmin' ||
    (auth.rol === 'admin' && auth.negocioId === reserva.negocioId.toString());
  if (!isOwner && !isBusinessAdmin) {
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

async function listarReservasCliente(clienteId, query = {}) {
  ensureObjectId(clienteId, 'clienteId');
  const filter = { clienteId };
  if (query.fecha !== undefined) {
    parseCalendarDate(query.fecha);
    filter.fecha = query.fecha;
  }
  const reservas = await Reserva.find(filter)
    .populate('negocioId', 'nombre')
    .populate('servicioId', 'nombre')
    .sort({ fecha: 1, hora: 1 })
    .lean();
  return reservas.map(reservationData);
}

function getWeekRange(value) {
  const date = parseCalendarDate(value, 'semana');
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { inicio: formatDate(start), fin: formatDate(end) };
}

async function listarReservasNegocio(negocioId, query = {}) {
  ensureObjectId(negocioId, 'negocioId');
  const filter = { negocioId };
  if (query.fecha !== undefined && query.semana !== undefined) {
    throw new ValidationError('Indique fecha o semana, pero no ambos.', [
      { field: 'fecha', message: 'No se puede combinar con el filtro semana.' },
    ]);
  }
  if (query.fecha !== undefined) {
    parseCalendarDate(query.fecha);
    filter.fecha = query.fecha;
  } else if (query.semana !== undefined) {
    const { inicio, fin } = getWeekRange(query.semana);
    filter.fecha = { $gte: inicio, $lte: fin };
  }
  const reservas = await Reserva.find(filter)
    .populate('negocioId', 'nombre')
    .populate('servicioId', 'nombre')
    .populate('clienteId', 'nombre correo')
    .sort({ fecha: 1, hora: 1 })
    .lean();
  return reservas.map(reservationData);
}

module.exports = {
  crearReserva,
  cancelarReserva,
  listarReservasCliente,
  listarReservasNegocio,
};
