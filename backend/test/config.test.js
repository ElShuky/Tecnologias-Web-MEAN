const test = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../src/config');

test('readConfig asigna por defecto la URI de MongoDB local del contenedor', () => {
  const config = readConfig({});
  assert.equal(config.mongodbUri, 'mongodb://localhost:27017/reservas');
  assert.equal(config.port, 3000);
  assert.equal(config.frontendUrl, 'http://localhost:4200');
  assert.equal(config.jwtSecret.length >= 16, true);
});

test('readConfig respeta variables de entorno personalizadas', () => {
  const config = readConfig({
    MONGODB_URI: 'mongodb://mongo:27017/reservas',
    JWT_SECRET: 'mi-clave-super-secreta-de-prueba',
    FRONTEND_URL: 'http://localhost:8080',
    PORT: '4000',
  });
  assert.equal(config.mongodbUri, 'mongodb://mongo:27017/reservas');
  assert.equal(config.jwtSecret, 'mi-clave-super-secreta-de-prueba');
  assert.equal(config.frontendUrl, 'http://localhost:8080');
  assert.equal(config.port, 4000);
});

test('readConfig rechaza URI de MongoDB con esquema inválido', () => {
  assert.throws(
    () => readConfig({ MONGODB_URI: 'http://localhost:27017' }),
    /Configuración inválida: MONGODB_URI/,
  );
});
