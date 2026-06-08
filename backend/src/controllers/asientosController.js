const pool = require('../config/db');

async function insertAudit(tabla, accion, usuario_id, datos, ip) {
	try {
		await pool.query(
			'INSERT INTO auditoria (tabla, accion, usuario_id, datos, ip) VALUES ($1,$2,$3,$4,$5)',
			[tabla, accion, usuario_id || null, JSON.stringify(datos || {}), ip || null]
		);
	} catch (err) {
		console.error('Error registrando auditoria:', err);
	}
}

// GET /api/asientos/:viaje_id
async function getAsientosPorViaje(req, res) {
	try {
		const { viaje_id } = req.params;

		const viajeQuery = await pool.query(
			`SELECT
				v.id,
				v.ruta_id,
				v.bus_id,
				v.fecha_salida,
				v.fecha_llegada,
				v.estado,
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
			WHERE v.id = $1`,
			[viaje_id]
		);
		if (!viajeQuery.rows.length) {
			return res.status(404).json({ message: 'Viaje no encontrado' });
		}

		const viaje = viajeQuery.rows[0];
		const { bus_id } = viaje;

		const q = `
			SELECT
				a.id,
				a.codigo,
				a.piso,
				a.fila,
				a.columna,
				a.tipo,
				CASE
					WHEN r.estado = 'pagado' THEN 'pagado'
					WHEN r.estado = 'reservado' AND r.expira_en > NOW() THEN 'reservado'
					WHEN r.estado = 'liberado' THEN 'liberado'
					ELSE 'disponible'
				END AS estado,
				CASE
					WHEN r.estado = 'reservado' AND r.expira_en > NOW() THEN r.expira_en
					ELSE NULL
				END AS expira_en
			FROM configuracion_asientos a
			LEFT JOIN LATERAL (
				SELECT estado, expira_en
				FROM reservas
				WHERE asiento_id = a.id
				  AND viaje_id = $1
				ORDER BY created_at DESC, id DESC
				LIMIT 1
			) r ON true
			WHERE a.bus_id = $2
			ORDER BY a.piso ASC, a.fila ASC, a.columna ASC, a.id ASC
		`;

		const { rows } = await pool.query(q, [viaje_id, bus_id]);
		res.json({ viaje, asientos: rows });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al obtener asientos' });
	}
}

// POST /api/asientos/seleccionar
async function seleccionarAsiento(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		const { viaje_id, asiento_id } = req.body;

		if (!viaje_id || !asiento_id) {
			return res.status(400).json({ message: 'viaje_id y asiento_id son obligatorios' });
		}

		await client.query('BEGIN');

		// Bloquear fila del asiento para serializar accesos concurrentes
		const asientoCheck = await client.query(
			`SELECT a.id FROM configuracion_asientos a
			 JOIN viajes v ON v.bus_id = a.bus_id
			 WHERE a.id = $1 AND v.id = $2
			 FOR UPDATE`,
			[asiento_id, viaje_id]
		);
		if (!asientoCheck.rows.length) {
			await client.query('ROLLBACK');
			return res.status(404).json({ message: 'Asiento no encontrado para este viaje' });
		}

		const existing = await client.query(
			`SELECT id FROM reservas
			 WHERE asiento_id = $1
			   AND viaje_id = $2
			   AND (
			     (estado = 'reservado' AND expira_en > NOW())
			     OR estado = 'pagado'
			   )`,
			[asiento_id, viaje_id]
		);
		if (existing.rows.length) {
			await client.query('ROLLBACK');
			return res.status(409).json({ message: 'El asiento ya está reservado o pagado' });
		}

		const result = await client.query(
			`INSERT INTO reservas (viaje_id, asiento_id, pasajero_id, estado, expira_en)
			 VALUES ($1, $2, $3, 'reservado', NOW() + INTERVAL '10 minutes')
			 RETURNING id, expira_en`,
			[viaje_id, asiento_id, null]
		);

		await client.query('COMMIT');

		const { id: reserva_id, expira_en } = result.rows[0];
		await insertAudit(
			'reservas', 'CREATE', usuario.id,
			{ reserva_id, viaje_id, asiento_id },
			req.ip || req.headers['x-forwarded-for']
		);

		res.status(201).json({ reserva_id, expira_en });
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al seleccionar asiento' });
	} finally {
		client.release();
	}
}

// DELETE /api/asientos/liberar/:reserva_id
async function liberarAsiento(req, res) {
	try {
		const usuario = req.usuario || {};
		const { reserva_id } = req.params;

		const reserva = await pool.query(
			'SELECT id, pasajero_id, estado FROM reservas WHERE id = $1',
			[reserva_id]
		);
		if (!reserva.rows.length) {
			return res.status(404).json({ message: 'Reserva no encontrada' });
		}

		const r = reserva.rows[0];
		if (usuario.rol !== 'admin' && r.pasajero_id !== usuario.id) {
			return res.status(403).json({ message: 'No tienes permiso para liberar esta reserva' });
		}

		if (r.estado !== 'reservado') {
			return res.status(409).json({ message: 'Solo se pueden liberar reservas en estado "reservado"' });
		}

		await pool.query("UPDATE reservas SET estado = 'liberado' WHERE id = $1", [reserva_id]);
		await insertAudit(
			'reservas', 'LIBERAR', usuario.id,
			{ reserva_id },
			req.ip || req.headers['x-forwarded-for']
		);

		res.json({ message: 'Asiento liberado correctamente' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al liberar asiento' });
	}
}

module.exports = { getAsientosPorViaje, seleccionarAsiento, liberarAsiento };
