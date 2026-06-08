const express = require('express');
const router = express.Router();

const {
	getRutas,
	getRutaById,
	createRuta,
	updateRuta,
	deleteRuta,
} = require('../controllers/rutasController');

const { verificarToken } = require('../middlewares/auth');
const { soloAdmin } = require('../middlewares/roles');

router.get('/', getRutas);
router.get('/:id', getRutaById);
router.post('/', verificarToken, soloAdmin, createRuta);
router.put('/:id', verificarToken, soloAdmin, updateRuta);
router.delete('/:id', verificarToken, soloAdmin, deleteRuta);

module.exports = router;
