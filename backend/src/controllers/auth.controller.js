const authService = require('../services/auth.service');

/**
 * Controlador para registro de clientes (POST /api/auth/registro).
 */
async function registro(req, res, next) {
  try {
    const { nombre, correo, password, contrasena } = req.body || {};
    const clave = password || contrasena || (req.body && req.body['contraseña']);

    const usuario = await authService.registrarCliente({
      nombre,
      correo,
      password: clave,
    });

    return res.status(201).json({
      success: true,
      data: usuario,
      message: 'Usuario registrado exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Controlador para inicio de sesión (POST /api/auth/login).
 */
async function login(req, res, next) {
  try {
    const { correo, password, contrasena } = req.body || {};
    const clave = password || contrasena || (req.body && req.body['contraseña']);
    const resultado = await authService.iniciarSesion({
      correo,
      password: clave,
    });

    return res.status(200).json({
      success: true,
      data: resultado,
      message: 'Inicio de sesión exitoso.',
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Endpoint protegido para comprobar la identidad autenticada.
 */
function me(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user.sub,
      rol: req.user.rol,
      ...(req.user.negocioId ? { negocioId: req.user.negocioId } : {}),
    },
  });
}

module.exports = {
  registro,
  login,
  me,
};
