const express = require('express');
const reservaController = require('../controllers/reserva.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/reservas', authenticate, requireRoles('cliente'), reservaController.crear);
router.patch(
  '/reservas/:reservaId/cancelar',
  authenticate,
  requireRoles('admin', 'superadmin'),
  reservaController.cancelar,
);

module.exports = router;
