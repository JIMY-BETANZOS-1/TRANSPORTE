const pool = require('../config/db');

// Helper: insert an audit record
async function insertAudit(tabla, accion, usuario_id, datos, ip) {
	try {
		const q = `INSERT INTO auditoria (tabla, accion, usuario_id, datos, ip) VALUES ($1,$2,$3,$4,$5)`;
		await pool.query(q, [tabla, accion, usuario_id || null, JSON.stringify(datos || {}), ip || null]);
	} catch (err) {
		console.error('Error registrando auditoria:', err);
	}
}

// GET /api/buses
async function getBuses(req, res) {
	try {
		const { estado } = req.query;
		const q = estado ? 'SELECT * FROM buses WHERE estado = $1 ORDER BY id' : 'SELECT * FROM buses ORDER BY id';
		const params = estado ? [estado] : [];
		const { rows } = await pool.query(q, params);
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener buses' });
	}
}

// GET /api/buses/:id
async function getBusById(req, res) {
	try {
		const { id } = req.params;
		const busRes = await pool.query('SELECT * FROM buses WHERE id = $1', [id]);
		if (!busRes.rows.length) return res.status(404).json({ message: 'Bus no encontrado' });
		const bus = busRes.rows[0];

		let asientos = [];
		try {
			// CORRECCIÓN: Apuntar a configuracion_asientos y ordenar por codigo
			const s = await pool.query('SELECT * FROM configuracion_asientos WHERE bus_id = $1 ORDER BY codigo', [id]);
			asientos = s.rows;
		} catch (e) {
			console.error('Error al obtener configuración de asientos:', e);
		}

		res.json({ ...bus, asientos });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener el bus' });
	}
}

// POST /api/buses (solo admin)
async function createBus(req, res) {
	try {
		const usuario = req.usuario || {};
		const isAdmin = usuario.rol === 'admin';
		if (!isAdmin) return res.status(403).json({ message: 'Acceso denegado' });

		const {
			placa,
			modelo,
			anio,
			num_pisos,
			capacidad_total,
			servicios,
			tiene_wifi,
			tiene_tv,
			tiene_usb,
			tiene_bano,
			tiene_aire,
			tipo_asiento,
			nivel_servicio,
			estado,
			fotos,
		} = req.body;

		const q = `INSERT INTO buses (placa, modelo, anio, num_pisos, capacidad_total, servicios, tiene_wifi, tiene_tv, tiene_usb, tiene_bano, tiene_aire, tipo_asiento, nivel_servicio, estado, fotos)
						 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`;
		const params = [
			placa,
			modelo,
			anio,
			num_pisos,
			capacidad_total,
			servicios ? JSON.stringify(servicios) : null,
			tiene_wifi ?? false,
			tiene_tv ?? false,
			tiene_usb ?? false,
			tiene_bano ?? false,
			tiene_aire ?? false,
			tipo_asiento || 'semi-reclinable',
			nivel_servicio || 'economico',
			estado || 'operativo',
			fotos ? JSON.stringify(fotos) : null,
		];

		const { rows } = await pool.query(q, params);
		const nuevo = rows[0];

		await insertAudit('buses', 'CREATE', usuario.id, nuevo, req.ip || req.headers['x-forwarded-for']);

		res.status(201).json(nuevo);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al crear el bus' });
	}
}

// PUT /api/buses/:id (solo admin)
async function updateBus(req, res) {
	try {
		const usuario = req.usuario || {};
		const isAdmin = usuario.rol === 'admin';
		if (!isAdmin) return res.status(403).json({ message: 'Acceso denegado' });

		const { id } = req.params;
		const {
			placa,
			modelo,
			anio,
			num_pisos,
			capacidad_total,
			servicios,
			tiene_wifi,
			tiene_tv,
			tiene_usb,
			tiene_bano,
			tiene_aire,
			tipo_asiento,
			nivel_servicio,
			estado,
			fotos,
		} = req.body;

		const q = `UPDATE buses SET placa=$1, modelo=$2, anio=$3, num_pisos=$4, capacidad_total=$5, servicios=$6, tiene_wifi=$7, tiene_tv=$8, tiene_usb=$9, tiene_bano=$10, tiene_aire=$11, tipo_asiento=$12, nivel_servicio=$13, estado=$14, fotos=$15
							 WHERE id=$16 RETURNING *`;
		const params = [
			placa,
			modelo,
			anio,
			num_pisos,
			capacidad_total,
			servicios ? JSON.stringify(servicios) : null,
			tiene_wifi ?? false,
			tiene_tv ?? false,
			tiene_usb ?? false,
			tiene_bano ?? false,
			tiene_aire ?? false,
			tipo_asiento || 'semi-reclinable',
			nivel_servicio || 'economico',
			estado || 'operativo',
			fotos ? JSON.stringify(fotos) : null,
			id,
		];

		const { rows } = await pool.query(q, params);
		if (!rows.length) return res.status(404).json({ message: 'Bus no encontrado' });
		const updated = rows[0];

		await insertAudit('buses', 'UPDATE', usuario.id, updated, req.ip || req.headers['x-forwarded-for']);

		res.json(updated);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al actualizar el bus' });
	}
}

// PATCH /api/buses/:id/estado
async function patchBusEstado(req, res) {
	try {
		const { id } = req.params;
		const { estado } = req.body;
		const allowed = ['operativo', 'mantenimiento', 'fuera_de_servicio', 'desactivado'];
		if (!allowed.includes(estado)) return res.status(400).json({ message: 'Estado inválido' });

		const q = 'UPDATE buses SET estado=$1 WHERE id=$2 RETURNING *';
		const { rows } = await pool.query(q, [estado, id]);
		if (!rows.length) return res.status(404).json({ message: 'Bus no encontrado' });

		const usuario = req.usuario || {};
		await insertAudit('buses', 'PATCH_ESTADO', usuario.id, { id, estado }, req.ip || req.headers['x-forwarded-for']);

		res.json(rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al cambiar estado' });
	}
}

// DELETE /api/buses/:id (desactivar, solo admin)
async function deleteBus(req, res) {
	try {
		const usuario = req.usuario || {};
		const isAdmin = usuario.rol === 'admin';
		if (!isAdmin) return res.status(403).json({ message: 'Acceso denegado' });

		const { id } = req.params;

		// marcar como desactivado
		const q = `UPDATE buses SET estado = $1 WHERE id = $2 RETURNING *`;
		const { rows } = await pool.query(q, ['desactivado', id]);
		if (!rows.length) return res.status(404).json({ message: 'Bus no encontrado' });

		await insertAudit('buses', 'DELETE', usuario.id, { id }, req.ip || req.headers['x-forwarded-for']);

		res.json({ message: 'Bus desactivado', bus: rows[0] });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al desactivar el bus' });
	}
}

module.exports = {
	getBuses,
	getBusById,
	createBus,
	updateBus,
	patchBusEstado,
	deleteBus,
};

