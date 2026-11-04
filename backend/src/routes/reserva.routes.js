const express = require('express');
const reservaController = require('../controllers/reserva.controller');
const {
  authenticate,
  requireBusinessAccess,
  requireRoles,
} = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/reservas', authenticate, requireRoles('cliente'), reservaController.crear);
router.get(
  '/reservas/cliente',
  authenticate,
  requireRoles('cliente'),
  reservaController.listarCliente,
);
router.get(
  '/gestion/negocios/:negocioId/reservas',
  authenticate,
  requireRoles('admin', 'superadmin'),
  requireBusinessAccess,
  reservaController.listarNegocio,
);
router.patch(
  '/reservas/:reservaId/cancelar',
  authenticate,
  requireRoles('cliente', 'admin', 'superadmin'),
  reservaController.cancelar,
);

module.exports = router;
