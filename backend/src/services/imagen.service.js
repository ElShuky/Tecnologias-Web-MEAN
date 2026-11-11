const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Negocio } = require('../models');
const { NotFoundError, ValidationError } = require('../errors/app.error');
const { readConfig } = require('../config');

const IMAGE_TYPES = {
  logo: { field: 'logoUrl', folder: 'logos' },
  portada: { field: 'portadaUrl', folder: 'portadas' },
};

function extensionFor(file) {
  if (file.mimetype === 'image/png') {
    return 'png';
  }
  if (file.mimetype === 'image/jpeg') {
    return 'jpg';
  }
  return 'webp';
}

async function guardarImagen(negocioId, tipo, file) {
  const imageType = IMAGE_TYPES[tipo];
  if (!imageType) {
    throw new ValidationError('El tipo de imagen no es válido.', [
      { field: 'tipo', message: 'Use "logo" o "portada".' },
    ]);
  }
  const negocio = await Negocio.findOne({ _id: negocioId, activo: true })
    .select(`${imageType.field} personalizacion`)
    .lean();
  if (!negocio) {
    throw new NotFoundError('El negocio no fue encontrado.');
  }

  const uploadsDir = readConfig().uploadsDir;
  const folder = path.join(uploadsDir, imageType.folder);
  await fs.mkdir(folder, { recursive: true });
  const filename = `${negocioId}-${crypto.randomUUID()}.${extensionFor(file)}`;
  const absolutePath = path.join(folder, filename);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'wx' });
  const publicUrl = `/uploads/${imageType.folder}/${filename}`;
  const personalizationField = tipo === 'logo' ? 'personalizacion.logo' : 'personalizacion.portada';
  await Negocio.updateOne(
    { _id: negocioId },
    { $set: { [imageType.field]: publicUrl, [personalizationField]: publicUrl } },
  );
  const previousUrl = negocio.personalizacion?.[tipo] || negocio[imageType.field];
  if (previousUrl) {
    const previousPath = path.join(uploadsDir, previousUrl.replace(/^\/uploads\//, ''));
    await fs.rm(previousPath, { force: true });
  }
  return { tipo, url: publicUrl };
}

module.exports = { guardarImagen };
