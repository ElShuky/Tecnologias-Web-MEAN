const formularioService = require('../services/formulario.service');

async function obtenerPublico(req, res, next) {
  try {
    const data = await formularioService.obtenerFormularioPublico(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function obtenerGestion(req, res, next) {
  try {
    const data = await formularioService.obtenerFormularioGestion(
      req.user.negocioId,
      req.params.id,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function guardar(req, res, next) {
  try {
    const data = await formularioService.guardarFormulario(
      req.user.negocioId,
      req.params.id,
      req.body ?? {},
    );
    return res.json({
      success: true,
      data,
      message: 'Formulario del servicio actualizado exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obtenerPublico,
  obtenerGestion,
  guardar,
};
