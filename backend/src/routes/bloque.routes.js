const express = require('express');
const bloqueController = require('../controllers/bloque.controller');

const router = express.Router();

router.get('/negocios/:slug/servicios/:servicioId/bloques', bloqueController.listar);

module.exports = router;
