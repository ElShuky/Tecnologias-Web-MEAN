const negocioService = require('../services/negocio.service');
const { NotFoundError } = require('../errors/app.error');

async function registrar(req, res, next) {
  try {
    const negocio = await negocioService.registrarNegocio(req.body || {});
    return res.status(201).json({
      success: true,
      data: negocio,
      message: 'Negocio registrado exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

async function listar(req, res, next) {
  try {
    const negocios = await negocioService.listarNegocios({
      search: req.query.search,
      rubro: req.query.rubro,
    });
    return res.json({ success: true, data: negocios });
  } catch (error) {
    return next(error);
  }
}

async function obtenerPorSlug(req, res, next) {
  try {
    const negocio = await negocioService.obtenerNegocioPublico(req.params.slug);
    if (!negocio) {
      throw new NotFoundError('El negocio solicitado no fue encontrado.');
    }
    return res.json({ success: true, data: negocio });
  } catch (error) {
    return next(error);
  }
}

async function obtenerPorId(req, res, next) {
  try {
    const negocio = await negocioService.obtenerNegocioPorId(req.businessId);
    if (!negocio) {
      throw new NotFoundError('El negocio solicitado no fue encontrado.');
    }
    return res.json({ success: true, data: negocio });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registrar,
  listar,
  obtenerPorSlug,
  obtenerPorId,
};
