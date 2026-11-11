const personalizacionService = require('../services/personalizacion.service');

async function obtener(req, res, next) {
  try {
    const data = await personalizacionService.obtenerPersonalizacion(req.user.negocioId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const data = await personalizacionService.actualizarPersonalizacion(
      req.user.negocioId,
      req.body || {},
    );
    return res.json({
      success: true,
      data,
      message: 'Personalización actualizada exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { obtener, actualizar };
