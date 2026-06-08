const express = require('express');
const router = express.Router();

const {
	getAsientosPorViaje,
	seleccionarAsiento,
	liberarAsiento,
} = require('../controllers/asientosController');

const { verificarToken } = require('../middlewares/auth');

router.get('/:viaje_id', getAsientosPorViaje);
router.post('/seleccionar', seleccionarAsiento);
router.delete('/liberar/:reserva_id', verificarToken, liberarAsiento);

module.exports = router;
