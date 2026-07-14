const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function mapAdmin(row) {
	return {
		id: row.id,
		nombre: row.nombre,
		email: row.email,
		rol: row.rol,
		activo: row.activo,
		es_principal: row.es_principal,
		created_at: row.created_at,
	};
}

// GET /api/admin/metricas
async function getMetricas(req, res) {
	try {
		const { rows } = await pool.query(`
			SELECT
				(SELECT COUNT(*)::int FROM viajes) AS total_viajes,
				(SELECT COUNT(*)::int FROM reservas WHERE DATE(created_at) = CURRENT_DATE) AS reservas_hoy,
				COALESCE((
					SELECT SUM(p.monto)
					FROM pagos p
					WHERE p.estado = 'pagado'
					  AND DATE(p.created_at) >= DATE_TRUNC('month', CURRENT_DATE)::date
					  AND DATE(p.created_at) < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
				), 0) AS ingresos_mes,
				(SELECT COUNT(*)::int FROM buses WHERE estado = 'operativo') AS buses_operativos
		`);

		res.json(rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener métricas' });
	}
}

// GET /api/admin/admins
async function getAdmins(req, res) {
	try {
		const { rows } = await pool.query(
			`SELECT id, nombre, email, rol, activo, es_principal, created_at
			 FROM usuarios
			 WHERE rol = 'admin'
			 ORDER BY es_principal DESC, created_at ASC, id ASC`
		);

		res.json(rows.map(mapAdmin));
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener administradores' });
	}
}

// POST /api/admin/admins
async function createAdmin(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		if (!usuario.es_principal) {
			return res.status(403).json({ message: 'Solo el admin principal puede crear administradores' });
		}

		const { nombre, email, password, es_principal = false } = req.body;
		if (!nombre || !email || !password) {
			return res.status(400).json({ message: 'nombre, email y password son obligatorios' });
		}

		const existe = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
		if (existe.rows.length) {
			return res.status(409).json({ message: 'El email ya está registrado' });
		}

		const salt = await bcrypt.genSalt(10);
		const password_hash = await bcrypt.hash(password, salt);

		await client.query('BEGIN');

		const principalActual = await client.query(
			`SELECT id
			 FROM usuarios
			 WHERE rol = 'admin' AND es_principal IS TRUE
			 LIMIT 1
			 FOR UPDATE`
		);
		const marcarComoPrincipal = Boolean(es_principal) || !principalActual.rows.length;

		if (marcarComoPrincipal) {
			await client.query("UPDATE usuarios SET es_principal = FALSE WHERE rol = 'admin' AND es_principal IS TRUE");
		}

		const { rows } = await client.query(
			`INSERT INTO usuarios (nombre, email, password_hash, rol, es_principal)
			 VALUES ($1, $2, $3, 'admin', $4)
			 RETURNING id, nombre, email, rol, activo, es_principal, created_at`,
			[nombre, email, password_hash, marcarComoPrincipal]
		);

		await client.query('COMMIT');

		await insertAudit(
			'usuarios', 'CREATE_ADMIN', usuario.id,
			{ admin_id: rows[0].id, email, es_principal: rows[0].es_principal },
			req.ip || req.headers['x-forwarded-for']
		);

		res.status(201).json(mapAdmin(rows[0]));
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al crear el administrador' });
	} finally {
		client.release();
	}
}

// PATCH /api/admin/admins/:id/principal
async function setPrincipalAdmin(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		if (!usuario.es_principal) {
			return res.status(403).json({ message: 'Solo el admin principal puede cambiar el principal' });
		}

		const { id } = req.params;

		const target = await client.query(
			`SELECT id, nombre, email, rol, activo, es_principal, created_at
			 FROM usuarios
			 WHERE id = $1 AND rol = 'admin'`,
			[id]
		);

		if (!target.rows.length) {
			return res.status(404).json({ message: 'Administrador no encontrado' });
		}

		await client.query('BEGIN');
		await client.query("UPDATE usuarios SET es_principal = FALSE WHERE rol = 'admin'");
		await client.query("UPDATE usuarios SET es_principal = TRUE WHERE id = $1", [id]);
		await client.query('COMMIT');

		const updated = await client.query(
			`SELECT id, nombre, email, rol, activo, es_principal, created_at
			 FROM usuarios
			 WHERE id = $1`,
			[id]
		);

		await insertAudit(
			'usuarios', 'SET_PRINCIPAL_ADMIN', usuario.id,
			{ admin_id: Number(id) },
			req.ip || req.headers['x-forwarded-for']
		);

		res.json(mapAdmin(updated.rows[0]));
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al cambiar el admin principal' });
	} finally {
		client.release();
	}
}

module.exports = { getMetricas, getAdmins, createAdmin, setPrincipalAdmin };