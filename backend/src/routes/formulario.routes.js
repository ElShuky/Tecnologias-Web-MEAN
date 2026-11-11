const express = require('express');
const formularioController = require('../controllers/formulario.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/servicios/:id/formulario', formularioController.obtenerPublico);
router.get(
  '/gestion/servicios/:id/formulario',
  authenticate,
  requireRoles('admin'),
  formularioController.obtenerGestion,
);
router.put(
  '/servicios/:id/formulario',
  authenticate,
  requireRoles('admin'),
  formularioController.guardar,
);

module.exports = router;
