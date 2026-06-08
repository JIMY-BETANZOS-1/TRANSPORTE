const pool = require('../config/db');

async function insertAudit(tabla, accion, usuario_id, datos, ip) {
	try {
		const q = `INSERT INTO auditoria (tabla, accion, usuario_id, datos, ip) VALUES ($1,$2,$3,$4,$5)`;
		await pool.query(q, [tabla, accion, usuario_id || null, JSON.stringify(datos || {}), ip || null]);
	} catch (err) {
		console.error('Error registrando auditoria:', err);
	}
}

function mapRutaConTarifas(rows) {
	return rows.map((ruta) => ({
		...ruta,
		tarifas: Array.isArray(ruta.tarifas) ? ruta.tarifas : [],
	}));
}

function validarTarifas(tarifas) {
	if (tarifas === undefined) return null;
	if (!Array.isArray(tarifas)) return 'tarifas debe ser un arreglo';

	for (const tarifa of tarifas) {
		if (!tarifa || typeof tarifa !== 'object') return 'cada tarifa debe ser un objeto';
		if (!tarifa.tipo_asiento) return 'cada tarifa debe incluir tipo_asiento';
		if (tarifa.precio === undefined || tarifa.precio === null || tarifa.precio === '') return 'cada tarifa debe incluir precio';
		if (Number.isNaN(Number(tarifa.precio))) return 'precio debe ser numérico';
	}

	return null;
}

async function guardarTarifas(client, rutaId, tarifas) {
	if (tarifas === undefined) return;

	await client.query('DELETE FROM tarifas WHERE ruta_id = $1', [rutaId]);

	for (const tarifa of tarifas) {
		await client.query(
			'INSERT INTO tarifas (ruta_id, tipo_asiento, precio) VALUES ($1, $2, $3)',
			[rutaId, tarifa.tipo_asiento, tarifa.precio]
		);
	}
}

// GET /api/rutas
async function getRutas(req, res) {
	try {
		const q = `
			SELECT
				r.id,
				r.nombre,
				r.origen,
				r.destino,
				r.distancia_km,
				r.duracion_horas,
				COALESCE(
					json_agg(
						json_build_object(
							'id', t.id,
							'tipo_asiento', t.tipo_asiento,
							'precio', t.precio
						)
						ORDER BY t.id
					) FILTER (WHERE t.id IS NOT NULL),
					'[]'::json
				) AS tarifas
			FROM rutas r
			LEFT JOIN tarifas t ON t.ruta_id = r.id
			GROUP BY r.id
			ORDER BY r.id
		`;
		const { rows } = await pool.query(q);
		res.json(mapRutaConTarifas(rows));
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener rutas' });
	}
}

// GET /api/rutas/:id
async function getRutaById(req, res) {
	try {
		const { id } = req.params;
		const q = `
			SELECT
				r.id,
				r.nombre,
				r.origen,
				r.destino,
				r.distancia_km,
				r.duracion_horas,
				COALESCE(
					json_agg(
						json_build_object(
							'id', t.id,
							'tipo_asiento', t.tipo_asiento,
							'precio', t.precio
						)
						ORDER BY t.id
					) FILTER (WHERE t.id IS NOT NULL),
					'[]'::json
				) AS tarifas
			FROM rutas r
			LEFT JOIN tarifas t ON t.ruta_id = r.id
			WHERE r.id = $1
			GROUP BY r.id
		`;
		const { rows } = await pool.query(q, [id]);
		if (!rows.length) return res.status(404).json({ message: 'Ruta no encontrada' });
		res.json(mapRutaConTarifas(rows)[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener la ruta' });
	}
}

// POST /api/rutas (admin)
async function createRuta(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		if (usuario.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });

		const { nombre, origen, destino, distancia_km, duracion_horas, tarifas } = req.body;
		if (!nombre || !origen || !destino) {
			return res.status(400).json({ message: 'nombre, origen y destino son obligatorios' });
		}

		const tarifasError = validarTarifas(tarifas);
		if (tarifasError) return res.status(400).json({ message: tarifasError });

		await client.query('BEGIN');
		const rutaResult = await client.query(
			'INSERT INTO rutas (nombre, origen, destino, distancia_km, duracion_horas) VALUES ($1, $2, $3, $4, $5) RETURNING *',
			[nombre, origen, destino, distancia_km ?? null, duracion_horas ?? null]
		);
		const ruta = rutaResult.rows[0];

		await guardarTarifas(client, ruta.id, tarifas || []);
		await client.query('COMMIT');

		const resultado = await getRutaDetallePorId(ruta.id);
		await insertAudit('rutas', 'CREATE', usuario.id, resultado, req.ip || req.headers['x-forwarded-for']);

		res.status(201).json(resultado);
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al crear la ruta' });
	} finally {
		client.release();
	}
}

async function getRutaDetallePorId(id) {
	const q = `
		SELECT
			r.id,
			r.nombre,
			r.origen,
			r.destino,
			r.distancia_km,
			r.duracion_horas,
			COALESCE(
				json_agg(
					json_build_object(
						'id', t.id,
						'tipo_asiento', t.tipo_asiento,
						'precio', t.precio
					)
					ORDER BY t.id
				) FILTER (WHERE t.id IS NOT NULL),
				'[]'::json
			) AS tarifas
		FROM rutas r
		LEFT JOIN tarifas t ON t.ruta_id = r.id
		WHERE r.id = $1
		GROUP BY r.id
	`;
	const { rows } = await pool.query(q, [id]);
	return mapRutaConTarifas(rows)[0] || null;
}

// PUT /api/rutas/:id (admin)
async function updateRuta(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		if (usuario.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });

		const { id } = req.params;
		const { nombre, origen, destino, distancia_km, duracion_horas, tarifas } = req.body;

		if (!nombre || !origen || !destino) {
			return res.status(400).json({ message: 'nombre, origen y destino son obligatorios' });
		}

		const tarifasError = validarTarifas(tarifas);
		if (tarifasError) return res.status(400).json({ message: tarifasError });

		await client.query('BEGIN');
		const rutaResult = await client.query(
			'UPDATE rutas SET nombre = $1, origen = $2, destino = $3, distancia_km = $4, duracion_horas = $5 WHERE id = $6 RETURNING *',
			[nombre, origen, destino, distancia_km ?? null, duracion_horas ?? null, id]
		);
		if (!rutaResult.rows.length) {
			await client.query('ROLLBACK');
			return res.status(404).json({ message: 'Ruta no encontrada' });
		}

		if (tarifas !== undefined) {
			await guardarTarifas(client, id, tarifas || []);
		}

		await client.query('COMMIT');
		const rutaActualizada = await getRutaDetallePorId(id);
		await insertAudit('rutas', 'UPDATE', usuario.id, rutaActualizada, req.ip || req.headers['x-forwarded-for']);

		res.json(rutaActualizada);
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al actualizar la ruta' });
	} finally {
		client.release();
	}
}

// DELETE /api/rutas/:id (admin)
async function deleteRuta(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		if (usuario.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });

		const { id } = req.params;
		const viajesActivos = await client.query(
			"SELECT COUNT(*)::int AS total FROM viajes WHERE ruta_id = $1 AND estado NOT IN ('cancelado', 'completado')",
			[id]
		);

		if (viajesActivos.rows[0].total > 0) {
			return res.status(409).json({ message: 'No se puede eliminar la ruta porque tiene viajes activos' });
		}

		await client.query('BEGIN');
		const rutasTarifas = await client.query('SELECT * FROM rutas WHERE id = $1', [id]);
		if (!rutasTarifas.rows.length) {
			await client.query('ROLLBACK');
			return res.status(404).json({ message: 'Ruta no encontrada' });
		}

		await client.query('DELETE FROM tarifas WHERE ruta_id = $1', [id]);
		await client.query('DELETE FROM rutas WHERE id = $1', [id]);
		await client.query('COMMIT');

		await insertAudit('rutas', 'DELETE', usuario.id, { id }, req.ip || req.headers['x-forwarded-for']);
		res.json({ message: 'Ruta eliminada correctamente' });
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al eliminar la ruta' });
	} finally {
		client.release();
	}
}

module.exports = {
	getRutas,
	getRutaById,
	createRuta,
	updateRuta,
	deleteRuta,
};
