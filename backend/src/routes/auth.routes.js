const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, requireRoles } = require('../middlewares/auth.middleware');

router.post('/registro', authController.registro);
router.post('/login', authController.login);
router.get('/me', authenticate, requireRoles('cliente', 'admin', 'superadmin'), authController.me);

module.exports = router;
