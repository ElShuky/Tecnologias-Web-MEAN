const express = require('express');
const seguimientoController = require('../controllers/seguimiento.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');

const router = express.Router();
const clienteAuth = [authenticate, requireRoles('cliente')];

router.get('/seguimientos', ...clienteAuth, seguimientoController.listar);
router.get('/seguimientos/:negocioId', ...clienteAuth, seguimientoController.estado);
router.post('/seguimientos/:negocioId', ...clienteAuth, seguimientoController.seguir);
router.delete('/seguimientos/:negocioId', ...clienteAuth, seguimientoController.dejarDeSeguir);

module.exports = router;
