const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../src/errors/app.error');
const { errorHandler } = require('../src/middlewares/error.middleware');

test('AppError crea instancias con código de estado y formato esperado', () => {
  const err = new AppError('Error de prueba', 418, 'I_AM_A_TEAPOT');
  assert.equal(err.message, 'Error de prueba');
  assert.equal(err.statusCode, 418);
  assert.equal(err.code, 'I_AM_A_TEAPOT');
  assert.equal(err.isOperational, true);
});

test('ValidationError establece statusCode 400 y almacena detalles de campos', () => {
  const details = [{ field: 'email', message: 'Email no válido' }];
  const err = new ValidationError('Validación fallida', details);
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'VALIDATION_ERROR');
  assert.deepEqual(err.details, details);
});

test('Subclases de error tienen los códigos HTTP correctos', () => {
  assert.equal(new BadRequestError().statusCode, 400);
  assert.equal(new UnauthorizedError().statusCode, 401);
  assert.equal(new ForbiddenError().statusCode, 403);
  assert.equal(new NotFoundError().statusCode, 404);
  assert.equal(new ConflictError().statusCode, 409);
});

test('errorHandler formatea adecuadamente la respuesta JSON de error operacional', () => {
  const mockErr = new ValidationError('Datos inválidos', [
    { field: 'duracion', message: 'Debe ser un número' },
  ]);

  let sentStatus = null;
  let sentJson = null;

  const mockRes = {
    status(code) {
      sentStatus = code;
      return this;
    },
    json(data) {
      sentJson = data;
      return this;
    },
  };

  errorHandler(mockErr, {}, mockRes, () => {});

  assert.equal(sentStatus, 400);
  assert.equal(sentJson.success, false);
  assert.equal(sentJson.error.code, 'VALIDATION_ERROR');
  assert.equal(sentJson.error.message, 'Datos inválidos');
  assert.equal(sentJson.error.details.length, 1);
  assert.equal(sentJson.error.details[0].field, 'duracion');
});
