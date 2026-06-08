const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./src/config/db');

const authRoutes = require('./src/routes/auth');
const busesRoutes = require('./src/routes/buses');
const rutasRoutes = require('./src/routes/rutas');
const viajesRoutes = require('./src/routes/viajes');
const asientosRoutes = require('./src/routes/asientos');
const pagosRoutes = require('./src/routes/pagos');
const adminRoutes = require('./src/routes/admin');

require('./src/jobs/liberarAsientos');
require('./src/jobs/publicarViajes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensaje: 'API Transportes Andinos funcionando' });
});

app.use('/api/auth', authRoutes);
app.use('/api/buses', busesRoutes);
app.use('/api/rutas', rutasRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/asientos', asientosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/admin', adminRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en puerto ${process.env.PORT}`);
});