const pool = require('../config/db');

async function publicarViajesProgramados() {
	try {
		const result = await pool.query(`
			UPDATE viajes
			SET estado = 'en_venta', publicado_automaticamente = TRUE
			WHERE viajes.estado = 'borrador'
			  AND viajes.fecha_salida <= NOW() + (viajes.horas_antes_venta * INTERVAL '1 hour')
			RETURNING viajes.id, viajes.horas_antes_venta, viajes.fecha_salida
		`);

		if (result.rowCount > 0) {
			for (const viaje of result.rows) {
				try {
					await pool.query(
						`INSERT INTO auditoria (tabla, accion, usuario_id, datos, ip) VALUES ($1,$2,$3,$4,$5)`,
						[
							'viajes',
							'AUTO_PUBLICADO',
							null,
							JSON.stringify({ id: viaje.id, horas_antes_venta: viaje.horas_antes_venta, fecha_salida: viaje.fecha_salida }),
							null,
						]
					);
				} catch (auditErr) {
					console.error('[publicarViajes] Error registrando auditoria:', auditErr);
				}
			}
			console.log(`[publicarViajes] ${result.rowCount} viaje(s) publicado(s) automáticamente`);
		}
	} catch (err) {
		console.error('[publicarViajes] Error al publicar viajes programados:', err);
	}
}

publicarViajesProgramados();
setInterval(publicarViajesProgramados, 5 * 60 * 1000);

module.exports = publicarViajesProgramados;
