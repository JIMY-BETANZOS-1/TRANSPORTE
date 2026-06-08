const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const generarToken = (usuario) =>
  jwt.sign(
    { id: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email y password son requeridos' });

  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, email, password_hash, rol, activo, es_principal FROM usuarios WHERE email = $1',
      [email]
    );

    const usuario = rows[0];

    if (!usuario)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    if (!usuario.activo)
      return res.status(403).json({ error: 'Cuenta desactivada' });

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValido)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    await pool.query(
      `INSERT INTO auditoria (tabla, accion, usuario_id, ip)
       VALUES ('usuarios', 'LOGIN', $1, $2)`,
      [usuario.id, req.ip]
    );

    const token = generarToken(usuario);

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        es_principal: usuario.es_principal,
      },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const registro = async (req, res) => {
  const { nombre, email, password, rol = 'operador' } = req.body;

  if (!nombre || !email || !password)
    return res.status(400).json({ error: 'Nombre, email y password son requeridos' });

  if (!['admin', 'operador'].includes(rol))
    return res.status(400).json({ error: 'Rol inválido' });

  if (rol === 'admin')
    return res.status(403).json({ error: 'Use la gestión de admins para crear administradores' });

  try {
    const existe = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existe.rows.length)
      return res.status(409).json({ error: 'El email ya está registrado' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, es_principal)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, nombre, email, rol, es_principal, created_at`,
      [nombre, email, password_hash, rol]
    );

    await pool.query(
      `INSERT INTO auditoria (tabla, accion, usuario_id, ip, datos)
       VALUES ('usuarios', 'REGISTRO', $1, $2, $3)`,
      [rows[0].id, req.ip, JSON.stringify({ email, rol })]
    );

    const token = generarToken(rows[0]);

    res.status(201).json({
      token,
      usuario: rows[0],
    });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const perfil = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, email, rol, es_principal, activo, created_at FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    if (!rows[0])
      return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Error en perfil:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const cambiarPassword = async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body;

  if (!passwordActual || !passwordNuevo)
    return res.status(400).json({ error: 'Se requieren ambas contraseñas' });

  if (passwordNuevo.length < 6)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    const valido = await bcrypt.compare(passwordActual, rows[0].password_hash);
    if (!valido)
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(passwordNuevo, salt);

    await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
      [password_hash, req.usuario.id]
    );

    await pool.query(
      `INSERT INTO auditoria (tabla, accion, usuario_id, ip)
       VALUES ('usuarios', 'CAMBIO_PASSWORD', $1, $2)`,
      [req.usuario.id, req.ip]
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en cambiarPassword:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login, registro, perfil, cambiarPassword };
