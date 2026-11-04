const reservaService = require('../services/reserva.service');

async function crear(req, res, next) {
  try {
    const data = await reservaService.crearReserva(req.user.sub, req.body || {});
    return res.status(201).json({
      success: true,
      data,
      message: 'Reserva creada exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelar(req, res, next) {
  try {
    const data = await reservaService.cancelarReserva(req.params.reservaId, req.user);
    return res.json({
      success: true,
      data,
      message: 'Reserva cancelada exitosamente.',
    });
  } catch (error) {
    return next(error);
  }
}

async function listarCliente(req, res, next) {
  try {
    const data = await reservaService.listarReservasCliente(req.user.sub, req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function listarNegocio(req, res, next) {
  try {
    const data = await reservaService.listarReservasNegocio(req.businessId, req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = { crear, cancelar, listarCliente, listarNegocio };
