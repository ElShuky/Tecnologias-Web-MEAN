const bloqueService = require('../services/bloque.service');

async function listar(req, res, next) {
  try {
    const data = await bloqueService.generarBloques(
      req.params.slug,
      req.params.servicioId,
      req.query.fecha,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listar };
