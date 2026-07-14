const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { login, registro, perfil, cambiarPassword } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');
const { soloAdmin } = require('../middlewares/roles');

// ── Middleware de validación para login ─────────────────
const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
];

// ── Middleware para verificar validación ────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Datos inválidos',
      details: errors.array().map(e => e.msg)
    });
  }
  next();
};

// Públicas
router.post('/login', validateLogin, handleValidationErrors, login);

// Solo admin puede crear usuarios
router.post('/registro', verificarToken, soloAdmin, registro);

// Protegidas (cualquier usuario autenticado)
router.get('/perfil', verificarToken, perfil);
router.put('/cambiar-password', verificarToken, cambiarPassword);

// 🚨 RUTA DE EMERGENCIA DEFINITIVA
router.post('/bypass-login', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE email = 'admin@transportesandinos.com'");

    if (!result.rows.length) {
      return res.status(404).json({ message: 'El admin no existe en la BD. Ejecuta primero los comandos SQL.' });
    }

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, rol: user.rol, es_principal: user.es_principal },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error en el bypass', error: err.message });
  }
});

module.exports = router;
