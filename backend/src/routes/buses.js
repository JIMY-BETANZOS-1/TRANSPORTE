const express = require('express');
const router = express.Router();

const {
  getBuses,
  getBusById,
  createBus,
  updateBus,
  patchBusEstado,
  deleteBus,
} = require('../controllers/busesController');

const { verificarToken } = require('../middlewares/auth');
const { soloAdmin, adminOOperador } = require('../middlewares/roles');

router.get('/', getBuses);
router.get('/:id', getBusById);
router.post('/', verificarToken, soloAdmin, createBus);
router.put('/:id', verificarToken, soloAdmin, updateBus);
router.patch('/:id/estado', verificarToken, adminOOperador, patchBusEstado);
router.delete('/:id', verificarToken, soloAdmin, deleteBus);

module.exports = router;
