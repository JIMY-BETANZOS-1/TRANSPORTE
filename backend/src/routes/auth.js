const router = require('express').Router();
const { login, registro, perfil, cambiarPassword } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');
const { soloAdmin } = require('../middlewares/roles');

// Públicas
router.post('/login', login);

// Solo admin puede crear usuarios
router.post('/registro', verificarToken, soloAdmin, registro);

// Protegidas (cualquier usuario autenticado)
router.get('/perfil', verificarToken, perfil);
router.put('/cambiar-password', verificarToken, cambiarPassword);

module.exports = router;
