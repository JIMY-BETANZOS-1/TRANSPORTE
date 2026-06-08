const express = require('express');
const router = express.Router();

const {
	getViajes,
	getViajeById,
	createViaje,
	patchViajeEstado,
} = require('../controllers/viajesController');

const { verificarToken } = require('../middlewares/auth');
const { soloAdmin, adminOOperador } = require('../middlewares/roles');

router.get('/', getViajes);
router.get('/:id', getViajeById);
router.post('/', verificarToken, soloAdmin, createViaje);
router.patch('/:id/estado', verificarToken, adminOOperador, patchViajeEstado);

module.exports = router;
