const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verificarToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token)
    return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT id, rol, activo, es_principal FROM usuarios WHERE id = $1',
      [decoded.id]
    );

    if (!rows[0])
      return res.status(401).json({ error: 'Usuario no encontrado' });

    if (!rows[0].activo)
      return res.status(403).json({ error: 'Cuenta desactivada' });

    req.usuario = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expirado' });
    return res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = { verificarToken };
