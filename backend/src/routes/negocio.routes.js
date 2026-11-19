const express = require('express');
const negocioController = require('../controllers/negocio.controller');
const {
  authenticate,
  requireBusinessAccess,
  requireRoles,
} = require('../middlewares/auth.middleware');
const {
  uploadImage,
  validateImageContent,
  handleImageUploadError,
} = require('../middlewares/image-upload.middleware');
const imagenController = require('../controllers/imagen.controller');

const router = express.Router();

router.post('/', authenticate, requireRoles('superadmin'), negocioController.registrar);
router.get(
  '/gestion/:negocioId',
  authenticate,
  requireRoles('admin', 'superadmin'),
  requireBusinessAccess,
  negocioController.obtenerPorId,
);
router.post(
  '/gestion/:negocioId/imagenes/:tipo',
  authenticate,
  requireRoles('admin'),
  requireBusinessAccess,
  uploadImage.single('imagen'),
  validateImageContent,
  handleImageUploadError,
  imagenController.cargar,
);
router.get('/', negocioController.listar);
router.get('/rubros', negocioController.listarRubros);
router.get('/:slug', negocioController.obtenerPorSlug);

module.exports = router;
