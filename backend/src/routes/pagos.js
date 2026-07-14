const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const { procesarPago, consultarPago, confirmarPago, confirmarPagoEfectivo } = require('../controllers/pagosController');
const { verificarToken, requireAdmin } = require('../middlewares/auth');

// ── Middleware de validación para confirmarPago ──────────
const validatePago = [
  body('reserva_id').isInt({ min: 1 }).withMessage('reserva_id inválido'),
  body('nombre').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Nombre inválido'),
  body('dni').optional().trim().matches(/^\d{8}$/).withMessage('DNI debe tener 8 dígitos'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('telefono').optional().trim().matches(/^\d{9}$/).withMessage('Teléfono debe tener 9 dígitos'),
  body('codigo_operacion').trim().matches(/^\d{6}$/).withMessage('Código debe tener 6 dígitos'),
  body('monto').isFloat({ min: 0.01 }).withMessage('Monto inválido'),
];

// ── Middleware para verificar validación ────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Datos inválidos',
      errors: errors.array().map(e => e.msg)
    });
  }
  next();
};

router.post('/', procesarPago);
router.post('/confirmar', validatePago, handleValidationErrors, confirmarPago);
router.post('/confirmar-efectivo', verificarToken, requireAdmin, confirmarPagoEfectivo);
router.get('/:reserva_id', verificarToken, consultarPago);

module.exports = router;
