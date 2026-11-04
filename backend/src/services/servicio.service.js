const mongoose = require('mongoose');
const { Servicio, Negocio } = require('../models');
const { ValidationError, NotFoundError } = require('../errors/app.error');

function publicService(servicio) {
  return {
    id: servicio._id.toString(),
    nombre: servicio.nombre,
    descripcion: servicio.descripcion,
    duracionMin: servicio.duracionMin,
    precio: servicio.precio,
    activo: servicio.activo,
  };
}

function validateServiceInput(data, partial = false) {
  const details = [];
  if (!partial || data.nombre !== undefined) {
    if (typeof data.nombre !== 'string' || data.nombre.trim().length < 2) {
      details.push({ field: 'nombre', message: 'El nombre debe tener al menos 2 caracteres.' });
    }
  }
  if (!partial || data.duracionMin !== undefined) {
    if (!Number.isInteger(data.duracionMin) || data.duracionMin < 1) {
      details.push({
        field: 'duracionMin',
        message: 'La duración debe ser un entero mayor que cero.',
      });
    }
  }
  if (!partial || data.precio !== undefined) {
    if (typeof data.precio !== 'number' || !Number.isFinite(data.precio) || data.precio < 0) {
      details.push({
        field: 'precio',
        message: 'El precio debe ser un número mayor o igual a cero.',
      });
    }
  }
  if (data.activo !== undefined && typeof data.activo !== 'boolean') {
    details.push({ field: 'activo', message: 'El estado activo debe ser booleano.' });
  }
  if (details.length) {
    throw new ValidationError('Error de validación del servicio.', details);
  }
}

function ensureObjectId(value, field) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError('El identificador no es válido.', [
      { field, message: 'Debe ser un ObjectId válido.' },
    ]);
  }
}

async function listarServicios(negocioId, includeInactive = true) {
  ensureObjectId(negocioId, 'negocioId');
  const filter = { negocioId };
  if (!includeInactive) {
    filter.activo = true;
  }
  const servicios = await Servicio.find(filter)
    .select('nombre descripcion duracionMin precio activo')
    .sort({ nombre: 1 })
    .lean();
  return servicios.map(publicService);
}

async function crearServicio(negocioId, data) {
  ensureObjectId(negocioId, 'negocioId');
  validateServiceInput(data);
  const negocio = await Negocio.findOne({ _id: negocioId, activo: true }).select('_id').lean();
  if (!negocio) {
    throw new NotFoundError('El negocio solicitado no fue encontrado.');
  }

  const servicio = await Servicio.create({
    negocioId,
    nombre: data.nombre.trim(),
    descripcion: typeof data.descripcion === 'string' ? data.descripcion.trim() : '',
    duracionMin: data.duracionMin,
    precio: data.precio,
    activo: data.activo ?? true,
  });
  return publicService(servicio);
}

async function editarServicio(negocioId, servicioId, data) {
  ensureObjectId(negocioId, 'negocioId');
  ensureObjectId(servicioId, 'servicioId');
  validateServiceInput(data, true);
  const updates = {};
  for (const field of ['nombre', 'descripcion', 'duracionMin', 'precio', 'activo']) {
    if (data[field] !== undefined) {
      updates[field] =
        field === 'nombre' || field === 'descripcion' ? data[field].trim() : data[field];
    }
  }
  const servicio = await Servicio.findOneAndUpdate(
    { _id: servicioId, negocioId },
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!servicio) {
    throw new NotFoundError('El servicio solicitado no fue encontrado.');
  }
  return publicService(servicio);
}

async function desactivarServicio(negocioId, servicioId) {
  return editarServicio(negocioId, servicioId, { activo: false });
}

async function listarServiciosPublicos(slug) {
  const negocio = await Negocio.findOne({ slug: slug.trim().toLowerCase(), activo: true })
    .select('_id')
    .lean();
  if (!negocio) {
    throw new NotFoundError('El negocio solicitado no fue encontrado.');
  }
  return listarServicios(negocio._id, false);
}

module.exports = {
  listarServicios,
  crearServicio,
  editarServicio,
  desactivarServicio,
  listarServiciosPublicos,
};
