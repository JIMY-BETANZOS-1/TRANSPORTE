const pool = require('../config/db');

async function insertAudit(tabla, accion, usuario_id, datos, ip) {
	try {
		const q = `INSERT INTO auditoria (tabla, accion, usuario_id, datos, ip) VALUES ($1,$2,$3,$4,$5)`;
		await pool.query(q, [tabla, accion, usuario_id || null, JSON.stringify(datos || {}), ip || null]);
	} catch (err) {
		console.error('Error registrando auditoria:', err);
	}
}

function mapViaje(row) {
	if (!row) return null;

	return {
		id: row.id,
		ruta_id: row.ruta_id,
		bus_id: row.bus_id,
		fecha_salida: row.fecha_salida,
		fecha_llegada: row.fecha_llegada,
		estado: row.estado,
		horas_antes_venta: row.horas_antes_venta != null ? Number(row.horas_antes_venta) : 24,
		publicado_automaticamente: row.publicado_automaticamente || false,
		ruta: row.ruta || null,
		bus: row.bus || null,
		asientos_disponibles: row.asientos_disponibles != null ? Number(row.asientos_disponibles) : null,
	};
}

function buildListFilters(query) {
	const conditions = ["v.estado = 'en_venta'"];
	const params = [];
	const fecha = typeof query.fecha === 'string' ? query.fecha.trim() : '';

	if (query.origen) {
		params.push(`%${query.origen}%`);
		conditions.push(`r.origen ILIKE $${params.length}`);
	}

	if (query.destino) {
		params.push(`%${query.destino}%`);
		conditions.push(`r.destino ILIKE $${params.length}`);
	}

	if (fecha) {
		params.push(fecha);
		conditions.push(`DATE(v.fecha_salida) = $${params.length}`);
	} else {
		conditions.push('v.fecha_salida >= NOW()');
	}

	return { conditions, params };
}

async function getViajeDetallePorId(id) {
	const q = `
		SELECT
			v.id,
			v.ruta_id,
			v.bus_id,
			v.fecha_salida,
			v.fecha_llegada,
			v.estado,
			v.horas_antes_venta,
			v.publicado_automaticamente,
			json_build_object(
				'id', r.id,
				'nombre', r.nombre,
				'origen', r.origen,
				'destino', r.destino,
				'distancia_km', r.distancia_km,
				'duracion_horas', r.duracion_horas,
				'tarifas', COALESCE((
					SELECT json_agg(
						json_build_object(
							'id', t.id,
							'tipo_asiento', t.tipo_asiento,
							'precio', t.precio
						)
						ORDER BY t.id
					)
					FROM tarifas t
					WHERE t.ruta_id = r.id
				), '[]'::json)
			) AS ruta,
			json_build_object(
				'id', b.id,
				'placa', b.placa,
				'modelo', b.modelo,
				'anio', b.anio,
				'num_pisos', b.num_pisos,
				'capacidad_total', b.capacidad_total,
				'servicios', b.servicios,
				'tiene_wifi', b.tiene_wifi,
				'tiene_tv', b.tiene_tv,
				'tiene_usb', b.tiene_usb,
				'tiene_bano', b.tiene_bano,
				'tiene_aire', b.tiene_aire,
				'tipo_asiento', b.tipo_asiento,
				'nivel_servicio', b.nivel_servicio,
				'estado', b.estado,
				'fotos', b.fotos
			) AS bus
		FROM viajes v
		JOIN rutas r ON r.id = v.ruta_id
		JOIN buses b ON b.id = v.bus_id
		WHERE v.id = $1
	`;
	const { rows } = await pool.query(q, [id]);
	return mapViaje(rows[0]);
}

// GET /api/viajes
async function getViajes(req, res) {
	try {
		const { conditions, params } = buildListFilters(req.query);
		const q = `
			SELECT
				v.id,
				v.ruta_id,
				v.bus_id,
				v.fecha_salida,
				v.fecha_llegada,
				v.estado,
				v.horas_antes_venta,
				v.publicado_automaticamente,
				json_build_object(
					'id', r.id,
					'nombre', r.nombre,
					'origen', r.origen,
					'destino', r.destino,
					'distancia_km', r.distancia_km,
					'duracion_horas', r.duracion_horas,
					'tarifas', COALESCE((
						SELECT json_agg(
							json_build_object(
								'id', t.id,
								'tipo_asiento', t.tipo_asiento,
								'precio', t.precio
							)
							ORDER BY t.id
						)
						FROM tarifas t
						WHERE t.ruta_id = r.id
					), '[]'::json)
				) AS ruta,
				json_build_object(
					'id', b.id,
					'placa', b.placa,
					'modelo', b.modelo,
					'anio', b.anio,
					'num_pisos', b.num_pisos,
					'capacidad_total', b.capacidad_total,
					'tiene_wifi', b.tiene_wifi,
					'tiene_tv', b.tiene_tv,
					'tiene_usb', b.tiene_usb,
					'tiene_bano', b.tiene_bano,
					'tiene_aire', b.tiene_aire,
					'tipo_asiento', b.tipo_asiento,
					'nivel_servicio', b.nivel_servicio,
					'estado', b.estado
				) AS bus,
				(
					SELECT GREATEST(COUNT(*) - COUNT(rsv.id), 0)
					FROM configuracion_asientos ca
					LEFT JOIN reservas rsv
						ON rsv.asiento_id = ca.id
						AND rsv.viaje_id = v.id
						AND rsv.estado IN ('reservado', 'pagado')
						AND (rsv.estado = 'pagado' OR rsv.expira_en > NOW())
					WHERE ca.bus_id = b.id
				) AS asientos_disponibles
			FROM viajes v
			JOIN rutas r ON r.id = v.ruta_id
			JOIN buses b ON b.id = v.bus_id
			WHERE ${conditions.join(' AND ')}
			ORDER BY v.fecha_salida ASC, v.id ASC
		`;
		const { rows } = await pool.query(q, params);
		res.json(rows.map(mapViaje));
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener viajes' });
	}
}

// GET /api/viajes/:id
async function getViajeById(req, res) {
	try {
		const { id } = req.params;
		const viaje = await getViajeDetallePorId(id);
		if (!viaje) return res.status(404).json({ message: 'Viaje no encontrado' });
		res.json(viaje);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener el viaje' });
	}
}

// POST /api/viajes (admin)
async function createViaje(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		if (usuario.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });

		const { ruta_id, bus_id, fecha_salida, fecha_llegada, horas_antes_venta } = req.body;
		if (!ruta_id || !bus_id || !fecha_salida) {
			return res.status(400).json({ message: 'ruta_id, bus_id y fecha_salida son obligatorios' });
		}

		const bus = await client.query('SELECT id, estado FROM buses WHERE id = $1', [bus_id]);
		if (!bus.rows.length) return res.status(404).json({ message: 'Bus no encontrado' });
		if (bus.rows[0].estado !== 'operativo') {
			return res.status(409).json({ message: 'El bus debe estar operativo para crear el viaje' });
		}

		const ruta = await client.query('SELECT id FROM rutas WHERE id = $1', [ruta_id]);
		if (!ruta.rows.length) return res.status(404).json({ message: 'Ruta no encontrada' });

		const result = await client.query(
			'INSERT INTO viajes (ruta_id, bus_id, fecha_salida, fecha_llegada, estado, horas_antes_venta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
			[ruta_id, bus_id, fecha_salida, fecha_llegada || null, 'borrador', horas_antes_venta || 24]
		);

		const viaje = await getViajeDetallePorId(result.rows[0].id);
		await insertAudit('viajes', 'CREATE', usuario.id, viaje, req.ip || req.headers['x-forwarded-for']);

		res.status(201).json(viaje);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al crear el viaje' });
	} finally {
		client.release();
	}
}

// PATCH /api/viajes/:id/estado
async function patchViajeEstado(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		if (!['admin', 'operador'].includes(usuario.rol)) {
			return res.status(403).json({ message: 'Acceso denegado' });
		}

		const { id } = req.params;
		const { estado } = req.body;
		const allowed = ['en_venta', 'cancelado'];
		if (!allowed.includes(estado)) {
			return res.status(400).json({ message: 'Estado inválido' });
		}

		await client.query('BEGIN');
		const viajeActual = await client.query('SELECT id, estado FROM viajes WHERE id = $1 FOR UPDATE', [id]);
		if (!viajeActual.rows.length) {
			await client.query('ROLLBACK');
			return res.status(404).json({ message: 'Viaje no encontrado' });
		}

		if (viajeActual.rows[0].estado === 'completado') {
			await client.query('ROLLBACK');
			return res.status(409).json({ message: 'No se puede modificar un viaje completado' });
		}

		if (estado === 'cancelado') {
			await client.query(
				"UPDATE reservas SET estado = 'cancelado' WHERE viaje_id = $1 AND estado IN ('reservado', 'pagado')",
				[id]
			);
		}

		await client.query('UPDATE viajes SET estado = $1 WHERE id = $2', [estado, id]);
		await client.query('COMMIT');

		const viaje = await getViajeDetallePorId(id);
		await insertAudit('viajes', 'PATCH_ESTADO', usuario.id, { id, estado }, req.ip || req.headers['x-forwarded-for']);

		res.json(viaje);
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al actualizar el estado del viaje' });
	} finally {
		client.release();
	}
}

module.exports = {
	getViajes,
	getViajeById,
	createViaje,
	patchViajeEstado,
};
