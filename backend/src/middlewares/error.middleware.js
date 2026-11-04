const { NotFoundError } = require('../errors/app.error');

/**
 * Middleware para capturar rutas no encontradas (404)
 * y dirigirlas al manejador global de errores.
 */
function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/**
 * Middleware centralizado de manejo de errores HTTP y de validación.
 * Garantiza un formato JSON consistente en toda la API.
 */
function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Error interno del servidor';
  let details = err.details || [];

  // Error de sintaxis JSON al parsear el cuerpo de la petición (Express)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'El cuerpo de la petición no contiene un JSON válido.';
  }

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Error de validación de campos';
    details = Object.keys(err.errors).map((key) => ({
      field: key,
      message: err.errors[key].message,
      value: err.errors[key].value,
    }));
  }

  // Error de ID inválido en Mongoose (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Identificador inválido para el campo "${err.path}".`;
    details = [{ field: err.path, value: err.value }];
  }

  // Error de duplicidad en índice único de MongoDB (código 11000)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY_ERROR';
    const fields = Object.keys(err.keyPattern || {});
    message = `Ya existe un registro con el mismo valor para: ${fields.join(', ')}.`;
    details = fields.map((field) => ({
      field,
      value: err.keyValue ? err.keyValue[field] : undefined,
    }));
  }

  // Si no es un error operacional controlado y estamos en producción, protegemos el mensaje interno
  const isOperational = err.isOperational || statusCode < 500;
  if (!isOperational && process.env.NODE_ENV === 'production') {
    message = 'Ha ocurrido un error inesperado en el servidor.';
  }

  if (statusCode >= 500) {
    console.error(`[ERROR 500] ${err.stack || err.message}`);
  }

  const responseBody = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (Array.isArray(details) && details.length > 0) {
    responseBody.error.details = details;
  }

  return res.status(statusCode).json(responseBody);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
