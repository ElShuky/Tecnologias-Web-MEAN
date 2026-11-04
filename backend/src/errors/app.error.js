/**
 * Clase base para errores operacionales de la aplicación.
 * Permite tipar y estandarizar el código de estado HTTP,
 * el código de error para el cliente y los detalles de validación.
 */
class AppError extends Error {
  /**
   * @param {string} message - Descripción legible del error.
   * @param {number} statusCode - Código HTTP de respuesta.
   * @param {string} code - Identificador legible del error (ej. 'VALIDATION_ERROR').
   * @param {Array<object>} [details=[]] - Lista detallada de fallos (ej. validaciones de campos).
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Petición inválida', details = []) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Error de validación de datos', details = []) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado o credenciales inválidas') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'No tiene permisos para realizar esta acción') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(message, 409, 'CONFLICT');
  }
}

module.exports = {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
