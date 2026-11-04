const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');
const { readConfig } = require('../config');
const { ValidationError, ConflictError, UnauthorizedError } = require('../errors/app.error');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = 10;
const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

/**
 * Servicio para registrar un nuevo usuario con rol de cliente.
 * Aplica hash seguro con bcrypt antes de persistir y rechaza correos duplicados.
 *
 * @param {object} params
 * @param {string} params.nombre - Nombre del cliente
 * @param {string} params.correo - Correo electrónico
 * @param {string} params.password - Contraseña en texto plano
 * @returns {Promise<object>} Datos del usuario registrado sin datos sensibles
 */
async function registrarCliente({ nombre, correo, password }) {
  const details = [];

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    details.push({
      field: 'nombre',
      message: 'El nombre es requerido y debe tener al menos 2 caracteres.',
    });
  }

  if (!correo || typeof correo !== 'string' || !EMAIL_REGEX.test(correo.trim())) {
    details.push({
      field: 'correo',
      message: 'El correo electrónico no es válido.',
    });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    details.push({
      field: 'password',
      message: 'La contraseña es requerida y debe tener al menos 8 caracteres.',
    });
  }

  if (details.length > 0) {
    throw new ValidationError('Error de validación en los datos de registro.', details);
  }

  const correoNormalizado = correo.trim().toLowerCase();

  // Validar si el correo ya se encuentra registrado
  const usuarioExistente = await Usuario.findOne({ correo: correoNormalizado });
  if (usuarioExistente) {
    throw new ConflictError('El correo electrónico ya se encuentra registrado.');
  }

  // Generar hash con bcrypt (salt rounds = 10)
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Crear usuario con rol de cliente
  const nuevoUsuario = new Usuario({
    nombre: nombre.trim(),
    correo: correoNormalizado,
    passwordHash,
    rol: 'cliente',
    negocioId: null,
  });

  try {
    await nuevoUsuario.save();
  } catch (error) {
    if (error.code === 11000) {
      throw new ConflictError('El correo electrónico ya se encuentra registrado.');
    }
    throw error;
  }

  return {
    id: nuevoUsuario._id.toString(),
    nombre: nuevoUsuario.nombre,
    correo: nuevoUsuario.correo,
    rol: nuevoUsuario.rol,
    creadoEn: nuevoUsuario.creadoEn,
  };
}

/**
 * Autentica un usuario y genera un JWT con sus permisos de acceso.
 *
 * @param {object} params
 * @param {string} params.correo - Correo electrónico
 * @param {string} params.password - Contraseña en texto plano
 * @returns {Promise<object>} Token y datos públicos del usuario
 */
async function iniciarSesion({ correo, password }) {
  if (
    !correo ||
    typeof correo !== 'string' ||
    !EMAIL_REGEX.test(correo.trim()) ||
    !password ||
    typeof password !== 'string'
  ) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  const correoNormalizado = correo.trim().toLowerCase();
  const usuario = await Usuario.findOne({ correo: correoNormalizado }).select(
    'passwordHash nombre correo rol negocioId creadoEn',
  );

  const passwordValida = usuario?.passwordHash
    ? await bcrypt.compare(password, usuario.passwordHash)
    : false;

  if (!usuario || !passwordValida || !['cliente', 'admin', 'superadmin'].includes(usuario.rol)) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  const payload = {
    sub: usuario._id.toString(),
    rol: usuario.rol,
  };

  if (usuario.rol === 'admin' && usuario.negocioId) {
    payload.negocioId = usuario.negocioId.toString();
  }

  const { jwtSecret } = readConfig();
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn: '1h',
  });

  return {
    token,
    usuario: {
      id: usuario._id.toString(),
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      ...(payload.negocioId ? { negocioId: payload.negocioId } : {}),
    },
  };
}

module.exports = {
  registrarCliente,
  iniciarSesion,
};
