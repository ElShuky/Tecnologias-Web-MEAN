const servicioService = require('../services/servicio.service');

async function listar(req, res, next) {
  try {
    return res.json({ success: true, data: await servicioService.listarServicios(req.businessId) });
  } catch (error) {
    return next(error);
  }
}

async function crear(req, res, next) {
  try {
    const servicio = await servicioService.crearServicio(req.businessId, req.body || {});
    return res
      .status(201)
      .json({ success: true, data: servicio, message: 'Servicio creado exitosamente.' });
  } catch (error) {
    return next(error);
  }
}

async function editar(req, res, next) {
  try {
    const servicio = await servicioService.editarServicio(
      req.businessId,
      req.params.servicioId,
      req.body || {},
    );
    return res.json({
      success: true,
      data: servicio,
      message: 'Servicio actualizado exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

async function desactivar(req, res, next) {
  try {
    const servicio = await servicioService.desactivarServicio(
      req.businessId,
      req.params.servicioId,
    );
    return res.json({
      success: true,
      data: servicio,
      message: 'Servicio desactivado exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

async function listarPublicos(req, res, next) {
  try {
    return res.json({
      success: true,
      data: await servicioService.listarServiciosPublicos(req.params.slug),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listar, crear, editar, desactivar, listarPublicos };
