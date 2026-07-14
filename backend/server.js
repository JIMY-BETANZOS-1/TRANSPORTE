const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

// ── Rate Limiting ──────────────────────────────────────────
// Límite global: 100 requests por 15 minutos por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Demasiadas solicitudes, intenta más tarde.' }
});

// Límite estricto para pagos: 10 intentos por hora
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Demasiados intentos de pago. Espera una hora.' }
});

// Límite para login: 5 intentos por 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Demasiados intentos de login. Espera 15 minutos.' }
});

const app = express();
// ── Security Middleware ────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(globalLimiter);
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensaje: 'API Transportes Andinos funcionando' });
});

// ── Rutas con limiters específicos ──────────────────────────
// NOTE: Se desactiva temporalmente el rate limiter para la ruta de login
// para evitar el bloqueo de 15 minutos por múltiples intentos.
// Para restaurar la protección, volver a habilitar la siguiente línea:
// app.use('/api/auth/login', loginLimiter);
app.use('/api/pagos/confirmar', paymentLimiter);

// ── Routes ─────────────────────────────────────────────────
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