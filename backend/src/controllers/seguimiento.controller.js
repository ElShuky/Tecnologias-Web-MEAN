const seguimientoService = require('../services/seguimiento.service');

async function seguir(req, res, next) {
  try {
    const data = await seguimientoService.seguirNegocio(req.user.sub, req.params.negocioId);
    return res.status(201).json({ success: true, data, message: 'Negocio seguido exitosamente.' });
  } catch (error) {
    return next(error);
  }
}

async function dejarDeSeguir(req, res, next) {
  try {
    const data = await seguimientoService.dejarDeSeguirNegocio(req.user.sub, req.params.negocioId);
    return res.json({ success: true, data, message: 'Dejaste de seguir el negocio.' });
  } catch (error) {
    return next(error);
  }
}

async function listar(req, res, next) {
  try {
    const data = await seguimientoService.listarNegociosSeguidos(req.user.sub);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function estado(req, res, next) {
  try {
    const data = await seguimientoService.estadoSeguimiento(req.user.sub, req.params.negocioId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = { seguir, dejarDeSeguir, listar, estado };
