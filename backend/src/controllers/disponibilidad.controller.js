const disponibilidadService = require('../services/disponibilidad.service');

async function consultar(req, res, next) {
  try {
    const data = await disponibilidadService.consultar(req.businessId, req.params.servicioId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function guardar(req, res, next) {
  try {
    const data = await disponibilidadService.guardar(
      req.businessId,
      req.params.servicioId,
      req.body || {},
    );
    return res.json({
      success: true,
      data,
      message: 'Disponibilidad guardada exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  consultar,
  guardar,
};
