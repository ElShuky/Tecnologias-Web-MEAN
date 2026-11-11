const express = require('express');
const servicioController = require('../controllers/servicio.controller');
const {
  authenticate,
  requireRoles,
  requireBusinessAccess,
} = require('../middlewares/auth.middleware');

const router = express.Router();
const businessAuth = [authenticate, requireRoles('admin', 'superadmin'), requireBusinessAccess];

router.get('/gestion/negocios/:negocioId/servicios', ...businessAuth, servicioController.listar);
router.post('/gestion/negocios/:negocioId/servicios', ...businessAuth, servicioController.crear);
router.patch(
  '/gestion/negocios/:negocioId/servicios/:servicioId',
  ...businessAuth,
  servicioController.editar,
);
router.delete(
  '/gestion/negocios/:negocioId/servicios/:servicioId',
  ...businessAuth,
  servicioController.desactivar,
);
router.get('/negocios/:slug/servicios', servicioController.listarPublicos);
router.get('/negocios/:slug/servicios/:servicioId', servicioController.obtenerPublico);

module.exports = router;
