const mongoose = require('mongoose');
const { Negocio, Seguimiento, Servicio } = require('../models');
const { ConflictError, NotFoundError, ValidationError } = require('../errors/app.error');

function ensureObjectId(value, field) {
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError('El identificador no es válido.', [
      { field, message: 'Debe ser un ObjectId válido.' },
    ]);
  }
}

function businessData(negocio, servicios) {
  return {
    id: negocio._id.toString(),
    nombre: negocio.nombre,
    rubro: negocio.rubro,
    slug: negocio.slug,
    descripcion: negocio.descripcion,
    servicios: servicios.map((servicio) => ({
      id: servicio._id.toString(),
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      duracionMin: servicio.duracionMin,
      precio: servicio.precio,
    })),
  };
}

async function seguirNegocio(clienteId, negocioId) {
  ensureObjectId(clienteId, 'clienteId');
  ensureObjectId(negocioId, 'negocioId');
  const negocio = await Negocio.findOne({ _id: negocioId, activo: true }).lean();
  if (!negocio) {
    throw new NotFoundError('El negocio solicitado no fue encontrado.');
  }
  try {
    await Seguimiento.create({ clienteId, negocioId });
  } catch (error) {
    if (error.code === 11000) {
      throw new ConflictError('Ya estás siguiendo este negocio.');
    }
    throw error;
  }
  return { negocioId: negocio._id.toString(), siguiendo: true };
}

async function dejarDeSeguirNegocio(clienteId, negocioId) {
  ensureObjectId(clienteId, 'clienteId');
  ensureObjectId(negocioId, 'negocioId');
  await Seguimiento.deleteOne({ clienteId, negocioId });
  return { negocioId, siguiendo: false };
}

async function listarNegociosSeguidos(clienteId) {
  ensureObjectId(clienteId, 'clienteId');
  const seguimientos = await Seguimiento.find({ clienteId }).select('negocioId').lean();
  const ids = seguimientos.map(({ negocioId }) => negocioId);
  const negocios = await Negocio.find({ _id: { $in: ids }, activo: true })
    .select('nombre rubro slug descripcion')
    .sort({ nombre: 1 })
    .lean();
  const servicios = await Servicio.find({
    negocioId: { $in: negocios.map(({ _id }) => _id) },
    activo: true,
  })
    .select('negocioId nombre descripcion duracionMin precio')
    .sort({ nombre: 1 })
    .lean();
  return negocios.map((negocio) =>
    businessData(
      negocio,
      servicios.filter((servicio) => servicio.negocioId.toString() === negocio._id.toString()),
    ),
  );
}

async function estadoSeguimiento(clienteId, negocioId) {
  ensureObjectId(clienteId, 'clienteId');
  ensureObjectId(negocioId, 'negocioId');
  const seguimiento = await Seguimiento.exists({ clienteId, negocioId });
  return { negocioId, siguiendo: Boolean(seguimiento) };
}

module.exports = {
  seguirNegocio,
  dejarDeSeguirNegocio,
  listarNegociosSeguidos,
  estadoSeguimiento,
};
