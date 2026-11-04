const express = require('express');
const disponibilidadController = require('../controllers/disponibilidad.controller');
const {
  authenticate,
  requireRoles,
  requireBusinessAccess,
} = require('../middlewares/auth.middleware');

const router = express.Router();
const businessAuth = [authenticate, requireRoles('admin', 'superadmin'), requireBusinessAccess];

router.get(
  '/gestion/negocios/:negocioId/servicios/:servicioId/disponibilidad',
  ...businessAuth,
  disponibilidadController.consultar,
);
router.put(
  '/gestion/negocios/:negocioId/servicios/:servicioId/disponibilidad',
  ...businessAuth,
  disponibilidadController.guardar,
);

module.exports = router;
