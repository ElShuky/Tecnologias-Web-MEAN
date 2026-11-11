const multer = require('multer');
const { ValidationError } = require('../errors/app.error');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      return callback(null, true);
    }
    return callback(
      new ValidationError('El formato de imagen no es válido.', [
        { field: 'imagen', message: 'Solo se aceptan imágenes PNG, JPG o WebP.' },
      ]),
    );
  },
});

function validateImageContent(request, _response, next) {
  const file = request.file;
  if (!file) {
    return next(
      new ValidationError('Debe enviar una imagen.', [
        { field: 'imagen', message: 'El campo imagen es obligatorio.' },
      ]),
    );
  }
  const isPng =
    file.buffer.length >= 8 &&
    file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg =
    file.buffer.length >= 3 && file.buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  const isWebp =
    file.buffer.length >= 12 &&
    file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isPng && !isJpeg && !isWebp) {
    return next(
      new ValidationError('El contenido real de la imagen no es válido.', [
        {
          field: 'imagen',
          message: 'La extensión o el tipo declarado no coincide con el contenido.',
        },
      ]),
    );
  }
  if (
    (isPng && file.mimetype !== 'image/png') ||
    (isJpeg && file.mimetype !== 'image/jpeg') ||
    (isWebp && file.mimetype !== 'image/webp')
  ) {
    return next(
      new ValidationError('El tipo real de la imagen no coincide.', [
        { field: 'imagen', message: 'No se permite cambiar la extensión o el tipo MIME.' },
      ]),
    );
  }
  const extension = file.originalname.toLowerCase().split('.').pop();
  const extensionMatches =
    (isPng && extension === 'png') ||
    (isJpeg && ['jpg', 'jpeg'].includes(extension)) ||
    (isWebp && extension === 'webp');
  if (!extensionMatches) {
    return next(
      new ValidationError('La extensión de la imagen no coincide.', [
        {
          field: 'imagen',
          message: 'El nombre del archivo debe usar la extensión real PNG, JPG o WebP.',
        },
      ]),
    );
  }
  return next();
}

function handleImageUploadError(error, _request, _response, next) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return next(
      new ValidationError('La imagen supera el tamaño máximo permitido.', [
        { field: 'imagen', message: 'Cada imagen debe pesar como máximo 5 MB.' },
      ]),
    );
  }
  return next(error);
}

module.exports = {
  MAX_IMAGE_SIZE,
  uploadImage,
  validateImageContent,
  handleImageUploadError,
};
