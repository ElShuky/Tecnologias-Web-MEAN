const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../src/server');
const { Usuario } = require('../src/models');

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservas_test_auth';

before(async () => {
  await mongoose.connect(TEST_MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  await Usuario.syncIndexes();
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

beforeEach(async () => {
  await Usuario.deleteMany({});
});

test('POST /api/auth/registro registra exitosamente a un cliente con rol cliente', async () => {
  const payload = {
    nombre: 'Juan Perez',
    correo: 'juan.perez@test.cl',
    password: 'MiPasswordSeguro123!',
  };

  const response = await request(app)
    .post('/api/auth/registro')
    .send(payload)
    .expect('Content-Type', /json/)
    .expect(201);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.nombre, 'Juan Perez');
  assert.equal(response.body.data.correo, 'juan.perez@test.cl');
  assert.equal(response.body.data.rol, 'cliente');
  assert.ok(response.body.data.id);
  assert.ok(response.body.data.creadoEn);

  // Garantizar que la contraseña nunca viaja en la respuesta
  assert.equal(response.body.data.password, undefined);
  assert.equal(response.body.data.passwordHash, undefined);
});

test('CRITERIO DE TERMINADO: la contraseña en base de datos nunca coincide con la original y está cifrada con bcrypt', async () => {
  const plainPassword = 'ClaveOriginalUltraSecreta2026';
  const payload = {
    nombre: 'Camila Morales',
    correo: 'camila.morales@test.cl',
    password: plainPassword,
  };

  const response = await request(app).post('/api/auth/registro').send(payload).expect(201);

  assert.equal(response.body.success, true);

  // Leer directamente desde MongoDB para verificar el almacenamiento físico
  const usuarioEnDb = await Usuario.findOne({ correo: 'camila.morales@test.cl' });
  assert.ok(usuarioEnDb, 'El usuario debe persistirse en MongoDB.');

  // 1. La contraseña almacenada NO coincide con la contraseña original en texto plano
  assert.notEqual(
    usuarioEnDb.passwordHash,
    plainPassword,
    'La contraseña en la BD nunca debe coincidir con el texto original.',
  );

  // 2. La contraseña almacenada tiene formato de hash bcrypt ($2b$ o $2a$)
  assert.match(
    usuarioEnDb.passwordHash,
    /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/,
    'El hash almacenado debe cumplir el formato estándar de bcrypt.',
  );

  // 3. bcrypt.compare valida la contraseña original contra el hash guardado
  const coincideCorrecta = await bcrypt.compare(plainPassword, usuarioEnDb.passwordHash);
  assert.equal(coincideCorrecta, true, 'bcrypt debe validar la clave original exitosamente.');

  // 4. bcrypt.compare rechaza una contraseña errónea
  const coincideIncorrecta = await bcrypt.compare('ClaveIncorrecta', usuarioEnDb.passwordHash);
  assert.equal(coincideIncorrecta, false, 'bcrypt debe rechazar claves incorrectas.');

  // 5. El usuario cliente no tiene negocioId asignado
  assert.equal(usuarioEnDb.negocioId, null);
  assert.equal(usuarioEnDb.rol, 'cliente');
});

test('POST /api/auth/registro rechaza correos duplicados con código 409 Conflict', async () => {
  const payload = {
    nombre: 'Usuario Original',
    correo: 'duplicado@test.cl',
    password: 'PasswordSeguro123',
  };

  // Primer registro exitoso
  await request(app).post('/api/auth/registro').send(payload).expect(201);

  // Segundo registro con mismo correo (incluso variando mayúsculas)
  const payloadDuplicado = {
    nombre: 'Usuario Duplicado',
    correo: 'DUPLICADO@test.cl',
    password: 'OtraPasswordSegura456',
  };

  const response = await request(app).post('/api/auth/registro').send(payloadDuplicado).expect(409);

  assert.equal(response.body.success, false);
  assert.ok(
    response.body.error.code === 'CONFLICT' || response.body.error.code === 'DUPLICATE_KEY_ERROR',
  );
  assert.match(
    response.body.error.message,
    /correo electrónico ya se encuentra registrado|Ya existe un registro/,
  );

  const totalUsuarios = await Usuario.countDocuments({ correo: 'duplicado@test.cl' });
  assert.equal(totalUsuarios, 1, 'No se debe haber duplicado el usuario en la BD.');
});

test('POST /api/auth/registro valida campos obligatorios y formatos incorrectos (400)', async () => {
  // Petición vacía
  const resVacia = await request(app).post('/api/auth/registro').send({}).expect(400);

  assert.equal(resVacia.body.success, false);
  assert.equal(resVacia.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(resVacia.body.error.details));

  const campos = resVacia.body.error.details.map((d) => d.field);
  assert.ok(campos.includes('nombre'));
  assert.ok(campos.includes('correo'));
  assert.ok(campos.includes('password'));

  // Correo inválido y password demasiado corto
  const resInvalido = await request(app)
    .post('/api/auth/registro')
    .send({
      nombre: 'A',
      correo: 'correo-sin-arroba',
      password: '123',
    })
    .expect(400);

  const camposInvalidos = resInvalido.body.error.details.map((d) => d.field);
  assert.ok(camposInvalidos.includes('nombre'));
  assert.ok(camposInvalidos.includes('correo'));
  assert.ok(camposInvalidos.includes('password'));
});

test('POST /api/auth/registro exige una contraseña de al menos 8 caracteres y datos escalares', async () => {
  const resCorta = await request(app)
    .post('/api/auth/registro')
    .send({
      nombre: 'Usuario Seguro',
      correo: 'corta@test.cl',
      password: '1234567',
    })
    .expect(400);

  assert.equal(resCorta.body.error.code, 'VALIDATION_ERROR');
  assert.ok(resCorta.body.error.details.some((detail) => detail.field === 'password'));

  const resObjeto = await request(app)
    .post('/api/auth/registro')
    .send({
      nombre: { $ne: null },
      correo: { $ne: null },
      password: { $ne: null },
    })
    .expect(400);

  assert.equal(resObjeto.body.error.code, 'VALIDATION_ERROR');
  assert.equal(await Usuario.countDocuments({}), 0);
});

test('POST /api/v1/auth/registro funciona de forma idéntica en la ruta versionada', async () => {
  const payload = {
    nombre: 'Versionado Test',
    correo: 'versionado@test.cl',
    password: 'PasswordSeguro123',
  };

  const response = await request(app).post('/api/v1/auth/registro').send(payload).expect(201);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.correo, 'versionado@test.cl');
});

test('POST /api/auth/login devuelve un JWT válido para un cliente', async () => {
  const password = 'PasswordCliente123';
  await Usuario.create({
    nombre: 'Cliente Login',
    correo: 'cliente.login@test.cl',
    passwordHash: await bcrypt.hash(password, 10),
    rol: 'cliente',
    negocioId: null,
  });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ correo: 'CLIENTE.LOGIN@test.cl', password })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.usuario.rol, 'cliente');
  assert.equal(response.body.data.usuario.negocioId, undefined);
  assert.ok(response.body.data.token);

  const payload = jwt.verify(
    response.body.data.token,
    process.env.JWT_SECRET || 'desarrollo-local-secreto-seguro-123456',
  );
  assert.equal(
    payload.sub,
    (await Usuario.findOne({ correo: 'cliente.login@test.cl' }))._id.toString(),
  );
  assert.equal(payload.rol, 'cliente');
  assert.equal(payload.negocioId, undefined);
});

test('POST /api/auth/login incluye negocioId para un administrador', async () => {
  const negocioId = new mongoose.Types.ObjectId();
  const password = 'PasswordAdmin123';
  await Usuario.create({
    nombre: 'Admin Login',
    correo: 'admin.login@test.cl',
    passwordHash: await bcrypt.hash(password, 10),
    rol: 'admin',
    negocioId,
  });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ correo: 'admin.login@test.cl', password })
    .expect(200);

  const payload = jwt.verify(
    response.body.data.token,
    process.env.JWT_SECRET || 'desarrollo-local-secreto-seguro-123456',
  );
  assert.equal(payload.rol, 'admin');
  assert.equal(payload.negocioId, negocioId.toString());
  assert.equal(response.body.data.usuario.negocioId, negocioId.toString());
});

test('POST /api/auth/login genera un JWT global para un superadmin', async () => {
  const password = 'PasswordSuperadmin123';
  await Usuario.create({
    nombre: 'Superadmin Login',
    correo: 'superadmin.login@test.cl',
    passwordHash: await bcrypt.hash(password, 10),
    rol: 'superadmin',
    negocioId: null,
  });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ correo: 'superadmin.login@test.cl', password })
    .expect(200);

  const payload = jwt.verify(
    response.body.data.token,
    process.env.JWT_SECRET || 'desarrollo-local-secreto-seguro-123456',
  );
  assert.equal(payload.rol, 'superadmin');
  assert.equal(payload.negocioId, undefined);
  assert.equal(response.body.data.usuario.negocioId, undefined);
});

test('POST /api/auth/login rechaza credenciales inválidas sin revelar si el correo existe', async () => {
  await Usuario.create({
    nombre: 'Usuario Existente',
    correo: 'existente.login@test.cl',
    passwordHash: await bcrypt.hash('PasswordCorrecta123', 10),
    rol: 'cliente',
    negocioId: null,
  });

  const respuestas = await Promise.all([
    request(app)
      .post('/api/auth/login')
      .send({ correo: 'existente.login@test.cl', password: 'PasswordIncorrecta' }),
    request(app)
      .post('/api/auth/login')
      .send({ correo: 'inexistente.login@test.cl', password: 'PasswordIncorrecta' }),
  ]);

  for (const response of respuestas) {
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Correo o contraseña incorrectos.',
      },
    });
  }
});

test('GET /api/auth/me rechaza token ausente y acepta roles autorizados', async () => {
  const sinToken = await request(app).get('/api/auth/me').expect(401);
  assert.deepEqual(sinToken.body, {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Token no proporcionado o inválido.',
    },
  });

  const password = 'PasswordMe123';
  await Usuario.create({
    nombre: 'Cliente Me',
    correo: 'cliente.me@test.cl',
    passwordHash: await bcrypt.hash(password, 10),
    rol: 'cliente',
    negocioId: null,
  });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ correo: 'cliente.me@test.cl', password })
    .expect(200);
  const response = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${login.body.data.token}`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.rol, 'cliente');
});
