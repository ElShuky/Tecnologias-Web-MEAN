const path = require('node:path');
const { URL } = require('node:url');

const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/reservas';
const DEFAULT_JWT_SECRET = 'desarrollo-local-secreto-seguro-123456';
const DEFAULT_FRONTEND_URL = 'http://localhost:4200';
const DEFAULT_PORT = 3000;
const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

function readConfig(environment = process.env) {
  const mongodbUri = environment.MONGODB_URI || DEFAULT_MONGODB_URI;
  const jwtSecret = environment.JWT_SECRET || DEFAULT_JWT_SECRET;
  const frontendUrlRaw = environment.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  const port = Number(environment.PORT || DEFAULT_PORT);
  const uploadsDir = environment.UPLOADS_DIR || DEFAULT_UPLOADS_DIR;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Configuración inválida: PORT debe ser un número entre 1 y 65535.');
  }

  if (!/^(mongodb(?:\+srv)?):\/\//.test(mongodbUri)) {
    throw new Error(
      'Configuración inválida: MONGODB_URI debe comenzar con mongodb:// o mongodb+srv://.',
    );
  }

  if (jwtSecret.length < 16) {
    throw new Error('Configuración inválida: JWT_SECRET debe tener al menos 16 caracteres.');
  }

  let frontendUrl;
  try {
    frontendUrl = new URL(frontendUrlRaw);
  } catch {
    throw new Error('Configuración inválida: FRONTEND_URL debe ser una URL válida.');
  }

  if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
    throw new Error('Configuración inválida: FRONTEND_URL debe usar http o https.');
  }

  return {
    mongodbUri,
    jwtSecret,
    port,
    frontendUrl: frontendUrl.origin,
    uploadsDir,
  };
}

module.exports = { readConfig };
