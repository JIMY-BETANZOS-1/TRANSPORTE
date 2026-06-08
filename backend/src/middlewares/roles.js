const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'admin')
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  next();
};

const soloPrincipal = (req, res, next) => {
  if (!req.usuario?.es_principal)
    return res.status(403).json({ error: 'Acceso restringido al admin principal' });
  next();
};

const adminOOperador = (req, res, next) => {
  if (!['admin', 'operador'].includes(req.usuario?.rol))
    return res.status(403).json({ error: 'Rol no autorizado' });
  next();
};

module.exports = { soloAdmin, soloPrincipal, adminOOperador };
