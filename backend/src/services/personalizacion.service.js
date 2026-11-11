const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { Negocio } = require('../models');
const { NotFoundError, ValidationError } = require('../errors/app.error');
const { readConfig } = require('../config');

const ALLOWED_FIELDS = new Set(['logo', 'portada', 'colorPrimario', 'colorSecundario']);
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function ensureBusinessId(value) {
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError('El negocio de la sesión no es válido.');
  }
}

function emptyPersonalization() {
  return {
    logo: null,
    portada: null,
    colorPrimario: null,
    colorSecundario: null,
  };
}

function normalizePersonalization(value) {
  return {
    ...emptyPersonalization(),
    ...(value || {}),
  };
}

function validateInput(data, negocioId) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationError('La personalización debe ser un objeto JSON.');
  }
  const unknownFields = Object.keys(data).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw new ValidationError('La personalización contiene campos no permitidos.', [
      ...unknownFields.map((field) => ({
        field,
        message: 'Solo se permiten logo, portada, colorPrimario y colorSecundario.',
      })),
    ]);
  }
  const details = [];
  for (const field of ['logo', 'portada']) {
    if (
      data[field] !== undefined &&
      data[field] !== null &&
      (typeof data[field] !== 'string' ||
        !new RegExp(
          `^/uploads/${field === 'logo' ? 'logos' : 'portadas'}/${negocioId}-[A-Za-z0-9-]+\\.(png|jpg|webp)$`,
        ).test(data[field]))
    ) {
      details.push({
        field,
        message: 'Debe ser una ruta de imagen del almacenamiento de la plataforma o null.',
      });
    }
  }
  for (const field of ['colorPrimario', 'colorSecundario']) {
    if (
      data[field] !== undefined &&
      data[field] !== null &&
      (typeof data[field] !== 'string' || !HEX_COLOR_REGEX.test(data[field]))
    ) {
      details.push({ field, message: 'Debe ser un color hexadecimal válido o null.' });
    }
  }
  if (details.length > 0) {
    throw new ValidationError('La personalización no es válida.', details);
  }
}

async function obtenerPersonalizacion(negocioId) {
  ensureBusinessId(negocioId);
  const negocio = await Negocio.findOne({ _id: negocioId, activo: true })
    .select('personalizacion logoUrl portadaUrl')
    .lean();
  if (!negocio) {
    throw new NotFoundError('El negocio no fue encontrado.');
  }
  return normalizePersonalization({
    ...negocio.personalizacion,
    logo: negocio.personalizacion?.logo || negocio.logoUrl || null,
    portada: negocio.personalizacion?.portada || negocio.portadaUrl || null,
  });
}

async function actualizarPersonalizacion(negocioId, data) {
  ensureBusinessId(negocioId);
  validateInput(data, negocioId);
  const negocio = await Negocio.findOne({ _id: negocioId, activo: true })
    .select('personalizacion logoUrl portadaUrl')
    .lean();
  if (!negocio) {
    throw new NotFoundError('El negocio no fue encontrado.');
  }
  const current = await obtenerPersonalizacion(negocioId);
  const next = { ...current, ...data };
  await Negocio.updateOne(
    { _id: negocioId },
    {
      $set: {
        personalizacion: next,
        logoUrl: next.logo || '',
        portadaUrl: next.portada || '',
      },
    },
  );
  const uploadsDir = readConfig().uploadsDir;
  for (const field of ['logo', 'portada']) {
    const previous = current[field];
    if (previous && previous !== next[field]) {
      await fs.rm(path.join(uploadsDir, previous.replace(/^\/uploads\//, '')), {
        force: true,
      });
    }
  }
  return next;
}

module.exports = {
  obtenerPersonalizacion,
  actualizarPersonalizacion,
  emptyPersonalization,
};
