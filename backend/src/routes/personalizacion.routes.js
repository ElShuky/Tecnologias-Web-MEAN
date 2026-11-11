const express = require('express');
const personalizacionController = require('../controllers/personalizacion.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get(
  '/personalizacion',
  authenticate,
  requireRoles('admin'),
  personalizacionController.obtener,
);
router.put(
  '/personalizacion',
  authenticate,
  requireRoles('admin'),
  personalizacionController.actualizar,
);

module.exports = router;
