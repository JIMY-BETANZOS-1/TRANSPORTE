const pool = require('../config/db');
const transporter = require('../config/mailer');
const { enviarComprobante } = require('../services/emailService');

// ── Sanitization ──────────────────────────────────────────
// Sanitizar strings para prevenir XSS
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'"]/g, '').trim().substring(0, 200);
}

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

function simularPasarela(metodo, monto) {
	// Simulación: siempre aprueba excepto monto <= 0
	if (!monto || monto <= 0) {
		return { aprobado: false, codigo: 'MONTO_INVALIDO', mensaje: 'Monto inválido' };
	}
	return { aprobado: true, codigo: 'APROBADO', referencia: `SIM-${Date.now()}` };
}

// POST /api/pagos
async function procesarPago(req, res) {
	const client = await pool.connect();
	try {
		const usuario = req.usuario || {};
		const { reserva_id, metodo, monto, datos_pasajero } = req.body;

		if (!reserva_id || !metodo || !monto) {
			return res.status(400).json({ message: 'reserva_id, metodo y monto son obligatorios' });
		}

		await client.query('BEGIN');

		// Verificar reserva: existe, estado reservado, no expirada
		const reservaResult = await client.query(
			`SELECT id, estado, expira_en, pasajero_id, viaje_id, asiento_id
			 FROM reservas WHERE id = $1 FOR UPDATE`,
			[reserva_id]
		);
		if (!reservaResult.rows.length) {
			await client.query('ROLLBACK');
			return res.status(404).json({ message: 'Reserva no encontrada' });
		}

		const reserva = reservaResult.rows[0];
		if (reserva.estado !== 'reservado') {
			await client.query('ROLLBACK');
			return res.status(409).json({ message: `La reserva está en estado '${reserva.estado}', no se puede pagar` });
		}
		if (new Date(reserva.expira_en) <= new Date()) {
			await client.query('ROLLBACK');
			return res.status(409).json({ message: 'La reserva ha expirado' });
		}

		// Actualizar datos del pasajero si se proporcionaron
		if (datos_pasajero && reserva.pasajero_id) {
			const { nombre, dni, email, telefono } = datos_pasajero;
			await client.query(
				`UPDATE pasajeros
				 SET nombre    = COALESCE($1, nombre),
				     dni       = COALESCE($2, dni),
				     email     = COALESCE($3, email),
				     telefono  = COALESCE($4, telefono)
				 WHERE id = $5`,
				[nombre || null, dni || null, email || null, telefono || null, reserva.pasajero_id]
			);
		}

		// Insertar pago en estado pendiente
		const pagoResult = await client.query(
			`INSERT INTO pagos (reserva_id, metodo, monto, estado)
			 VALUES ($1, $2, $3, 'pendiente')
			 RETURNING id`,
			[reserva_id, metodo, monto]
		);
		const pago_id = pagoResult.rows[0].id;

		// Simular llamada a pasarela de pago
		const respuestaPasarela = simularPasarela(metodo, monto);

		if (!respuestaPasarela.aprobado) {
			await client.query(
				"UPDATE pagos SET estado = 'rechazado' WHERE id = $1",
				[pago_id]
			);
			await client.query('COMMIT');
			await insertAudit(
				'pagos', 'RECHAZADO', usuario.id,
				{ pago_id, reserva_id, codigo: respuestaPasarela.codigo },
				req.ip || req.headers['x-forwarded-for']
			);
			return res.status(402).json({
				message: 'Pago rechazado por la pasarela',
				codigo: respuestaPasarela.codigo,
				pago_id,
				reserva_id,
				estado: 'rechazado',
			});
		}

		// Pago aprobado: actualizar reserva y pago
		await client.query(
			"UPDATE reservas SET estado = 'pagado' WHERE id = $1",
			[reserva_id]
		);
		await client.query(
			"UPDATE pagos SET estado = 'pagado', referencia_externa = $1 WHERE id = $2",
			[respuestaPasarela.referencia, pago_id]
		);

		await client.query('COMMIT');

		await insertAudit(
			'pagos', 'PAGADO', usuario.id,
			{ pago_id, reserva_id, metodo, monto, referencia: respuestaPasarela.referencia },
			req.ip || req.headers['x-forwarded-for']
		);

		res.status(201).json({ pago_id, reserva_id, estado: 'pagado', metodo, monto });
	} catch (err) {
		await client.query('ROLLBACK');
		console.error(err);
		res.status(500).json({ message: 'Error al procesar el pago' });
	} finally {
		client.release();
	}
}

// GET /api/pagos/:reserva_id
async function consultarPago(req, res) {
	try {
		const { reserva_id } = req.params;

		const result = await pool.query(
			`SELECT p.id AS pago_id, p.reserva_id, p.metodo, p.monto, p.estado,
			        p.referencia_externa, p.created_at
			 FROM pagos p
			 WHERE p.reserva_id = $1
			 ORDER BY p.created_at DESC
			 LIMIT 1`,
			[reserva_id]
		);

		if (!result.rows.length) {
			return res.status(404).json({ message: 'No se encontró pago para esta reserva' });
		}

		res.json(result.rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Error al consultar el pago' });
	}
}

async function confirmarPago(req, res) {
  const {
    reserva_id, nombre, dni, email, telefono,
    metodo_pago, codigo_operacion,
    ruta, asiento, fecha_salida, monto,
  } = req.body;

  if (!reserva_id || !codigo_operacion || !email) {
    return res.status(400).json({ message: 'reserva_id, codigo_operacion y email son obligatorios' });
  }
  if (!/^\d{6}$/.test(codigo_operacion)) {
    return res.status(400).json({ message: 'El código de operación debe tener exactamente 6 dígitos' });
  }

  const metodosValidos = ['culqi', 'yape', 'plin'];
  const metodo = metodosValidos.includes(metodo_pago) ? metodo_pago : 'yape';

  // ── Sanitizar inputs ───────────────────────────────────
  const nombreSafe = sanitize(nombre || '');
  const rutaSafe = sanitize(ruta || '');
  const asientoSafe = sanitize(typeof asiento === 'string' ? asiento : String(asiento?.codigo || ''));

  try {
    const reservaRes = await pool.query(
      'SELECT id, estado FROM reservas WHERE id = $1',
      [reserva_id]
    );
    if (!reservaRes.rows.length) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }
    if (reservaRes.rows[0].estado !== 'reservado') {
      return res.status(409).json({ message: 'La reserva no está en estado válido para pagar' });
    }

    const codigoUsado = await pool.query(
      'SELECT id FROM pagos WHERE codigo_operacion = $1',
      [codigo_operacion]
    );
    if (codigoUsado.rows.length) {
      return res.status(409).json({ message: 'El código de operación ya fue utilizado' });
    }

    await pool.query(
      `INSERT INTO pagos (reserva_id, metodo, monto, estado, codigo_operacion)
       VALUES ($1, $2, $3, 'pagado', $4)`,
      [reserva_id, metodo, monto || 0, codigo_operacion]
    );

    await pool.query(
      "UPDATE reservas SET estado = 'pagado' WHERE id = $1",
      [reserva_id]
    );

    await enviarComprobante({
      to: email,
      reserva_id,
      nombre: nombreSafe,
      dni,
      email,
      telefono,
      ruta: rutaSafe,
      asiento: asientoSafe,
      fecha_salida,
      monto,
      metodo_pago: metodo,
    });

    res.json({
      success: true,
      mensaje: `Pago confirmado. Comprobante enviado a ${email}`,
    });
  } catch (err) {
    console.error('Error al confirmar pago:', err);
    res.status(500).json({ message: 'Error al procesar el pago' });
  }
}

async function confirmarPagoEfectivo(req, res) {
  const {
    reserva_id, nombre, dni, email, telefono,
    monto, asiento, ruta, fecha_salida,
  } = req.body;

  if (!reserva_id || !monto) {
    return res.status(400).json({ message: 'reserva_id y monto son obligatorios' });
  }
  if (!dni || !/^[0-9]{8}$/.test(dni)) {
    return res.status(400).json({ message: 'DNI inválido' });
  }
  if (telefono && !/^[0-9]{9}$/.test(telefono)) {
    return res.status(400).json({ message: 'Teléfono inválido' });
  }

  const nombreSafe = sanitize(nombre || 'Cliente de ventanilla');
  const rutaSafe = sanitize(ruta || '');
  const asientoSafe = sanitize(typeof asiento === 'string' ? asiento : String(asiento || ''));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reservaRes = await client.query(
      'SELECT id, estado, pasajero_id FROM reservas WHERE id = $1 FOR UPDATE',
      [reserva_id]
    );
    if (!reservaRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    const reserva = reservaRes.rows[0];
    if (reserva.estado !== 'reservado') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'La reserva no está en estado válido para pagar' });
    }

    if (reserva.pasajero_id) {
      await client.query(
        `UPDATE pasajeros SET nombre = COALESCE($1, nombre), dni = COALESCE($2, dni), email = COALESCE($3, email), telefono = COALESCE($4, telefono) WHERE id = $5`,
        [nombreSafe, dni, email || null, telefono || null, reserva.pasajero_id]
      );
    } else {
      const pasajeroRes = await client.query(
        `INSERT INTO pasajeros (nombre, dni, email, telefono) VALUES ($1, $2, $3, $4) RETURNING id`,
        [nombreSafe, dni, email || null, telefono || null]
      );
      await client.query(
        'UPDATE reservas SET pasajero_id = $1 WHERE id = $2',
        [pasajeroRes.rows[0].id, reserva_id]
      );
    }

    const pagoRes = await client.query(
      `INSERT INTO pagos (reserva_id, metodo, monto, estado) VALUES ($1, 'efectivo', $2, 'pagado') RETURNING id`,
      [reserva_id, monto]
    );

    await client.query("UPDATE reservas SET estado = 'pagado' WHERE id = $1", [reserva_id]);

    await client.query('COMMIT');

    if (email) {
      await enviarComprobante({
        to: email,
        reserva_id,
        nombre: nombreSafe,
        dni,
        email,
        telefono,
        ruta: rutaSafe,
        asiento: asientoSafe,
        fecha_salida,
        monto,
        metodo_pago: 'efectivo',
      });
    }

    res.json({ success: true, mensaje: 'Pago en efectivo confirmado correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al confirmar pago en efectivo:', err);
    res.status(500).json({ message: 'Error al procesar el pago en efectivo' });
  } finally {
    client.release();
  }
}

module.exports = { procesarPago, consultarPago, confirmarPago, confirmarPagoEfectivo };
