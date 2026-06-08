const express = require('express');
const router = express.Router();

const { getMetricas, getAdmins, createAdmin, setPrincipalAdmin } = require('../controllers/adminController');
const { verificarToken } = require('../middlewares/auth');
const { soloAdmin, soloPrincipal } = require('../middlewares/roles');

router.get('/metricas', verificarToken, soloAdmin, getMetricas);
router.get('/admins', verificarToken, soloAdmin, getAdmins);
router.post('/admins', verificarToken, soloAdmin, soloPrincipal, createAdmin);
router.patch('/admins/:id/principal', verificarToken, soloAdmin, soloPrincipal, setPrincipalAdmin);

module.exports = router;