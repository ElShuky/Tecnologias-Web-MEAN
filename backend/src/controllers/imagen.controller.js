const imagenService = require('../services/imagen.service');

async function cargar(req, res, next) {
  try {
    const data = await imagenService.guardarImagen(req.businessId, req.params.tipo, req.file);
    return res.json({ success: true, data, message: 'Imagen del negocio actualizada.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { cargar };
