const jwt = require('jsonwebtoken');
const { readConfig } = require('../config');
const { UnauthorizedError, ForbiddenError } = require('../errors/app.error');

const AUTHENTICATED_ROLES = ['cliente', 'admin', 'superadmin'];
const INVALID_TOKEN_MESSAGE = 'Token no proporcionado o inválido.';

function authenticate(req, _res, next) {
  const authorization = req.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  if (!token) {
    return next(new UnauthorizedError(INVALID_TOKEN_MESSAGE));
  }

  try {
    const claims = jwt.verify(token, readConfig().jwtSecret);
    if (
      typeof claims !== 'object' ||
      claims === null ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.rol !== 'string'
    ) {
      return next(new UnauthorizedError(INVALID_TOKEN_MESSAGE));
    }

    req.user = claims;
    req.auth = claims;
    return next();
  } catch {
    return next(new UnauthorizedError(INVALID_TOKEN_MESSAGE));
  }
}

function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !AUTHENTICATED_ROLES.includes(req.user.rol) || !roles.includes(req.user.rol)) {
      return next(new ForbiddenError('No tiene permisos para realizar esta acción.'));
    }

    return next();
  };
}

function requireBusinessAccess(req, _res, next) {
  if (req.user?.rol === 'superadmin') {
    req.businessId = req.params.negocioId;
    return next();
  }

  const requestedBusinessId = req.params.negocioId;
  if (
    req.user?.rol === 'admin' &&
    typeof req.user.negocioId === 'string' &&
    requestedBusinessId === req.user.negocioId
  ) {
    req.businessId = req.user.negocioId;
    return next();
  }

  return next(new ForbiddenError('No tiene permisos sobre este negocio.'));
}

module.exports = {
  authenticate,
  requireRoles,
  requireBusinessAccess,
};
