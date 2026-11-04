const express = require('express');
const negocioController = require('../controllers/negocio.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', authenticate, requireRoles('superadmin'), negocioController.registrar);
router.get('/', negocioController.listar);
router.get('/:slug', negocioController.obtenerPorSlug);

module.exports = router;
