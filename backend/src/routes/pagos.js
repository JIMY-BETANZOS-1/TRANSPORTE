const express = require('express');
const router = express.Router();

const { procesarPago, consultarPago } = require('../controllers/pagosController');
const { verificarToken } = require('../middlewares/auth');

router.post('/', procesarPago);
router.get('/:reserva_id', verificarToken, consultarPago);

module.exports = router;
