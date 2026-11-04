const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const {
  authenticate,
  requireRoles,
  requireBusinessAccess,
} = require('../src/middlewares/auth.middleware');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
  };
}

test('auth middleware permite un administrador solo en su negocio', () => {
  const token = jwt.sign(
    { sub: 'user-id', rol: 'admin', negocioId: 'business-a' },
    'desarrollo-local-secreto-seguro-123456',
  );
  const req = {
    headers: { authorization: `Bearer ${token}` },
    get(name) {
      return this.headers[name.toLowerCase()];
    },
    params: { negocioId: 'business-a' },
  };
  const res = createResponse();
  let nextCalled = false;

  authenticate(req, res, () => {
    requireRoles('admin', 'superadmin')(req, res, () => {
      requireBusinessAccess(req, res, () => {
        nextCalled = true;
      });
    });
  });

  assert.equal(nextCalled, true);
});

test('auth middleware rechaza a un administrador que intenta acceder a otro negocio', () => {
  const req = {
    user: { sub: 'user-id', rol: 'admin', negocioId: 'business-a' },
    params: { negocioId: 'business-b' },
  };
  let error;

  requireBusinessAccess(req, {}, (receivedError) => {
    error = receivedError;
  });

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'FORBIDDEN');
});

test('auth middleware ignora negocioId enviado en el cuerpo y usa el del token', () => {
  const req = {
    user: { sub: 'user-id', rol: 'admin', negocioId: 'business-a' },
    body: { negocioId: 'business-b' },
    params: { negocioId: 'business-a' },
  };
  let nextCalled = false;

  requireBusinessAccess(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.businessId, 'business-a');
});

test('auth middleware permite al superadmin acceder a cualquier negocio', () => {
  const req = {
    user: { sub: 'user-id', rol: 'superadmin' },
    params: { negocioId: 'business-b' },
  };
  let nextCalled = false;

  requireBusinessAccess(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('auth middleware rechaza tokens ausentes, inválidos o mal formados', () => {
  const requests = [
    { headers: {}, get() {} },
    {
      headers: { authorization: 'Bearer token-invalido' },
      get(name) {
        return this.headers[name.toLowerCase()];
      },
    },
    {
      headers: {
        authorization: `Bearer ${jwt.sign(
          { rol: 'admin' },
          'desarrollo-local-secreto-seguro-123456',
        )}`,
      },
      get(name) {
        return this.headers[name.toLowerCase()];
      },
    },
  ];

  for (const req of requests) {
    let error;
    authenticate(req, {}, (receivedError) => {
      error = receivedError;
    });
    assert.equal(error.statusCode, 401);
    assert.equal(error.code, 'UNAUTHORIZED');
  }
});

test('requireRoles rechaza roles no autorizados con 403', () => {
  const req = { user: { sub: 'user-id', rol: 'rol-invalido' } };
  let error;

  requireRoles('cliente', 'admin', 'superadmin')(req, {}, (receivedError) => {
    error = receivedError;
  });

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'FORBIDDEN');
});
