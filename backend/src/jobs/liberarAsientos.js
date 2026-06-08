const pool = require('../config/db');

async function liberarAsientosExpirados() {
	try {
		const result = await pool.query(
			`UPDATE reservas SET estado = 'liberado'
			 WHERE estado = 'reservado' AND expira_en < NOW()`
		);
		if (result.rowCount > 0) {
			console.log(`[liberarAsientos] ${result.rowCount} reserva(s) expirada(s) liberadas`);
		}
	} catch (err) {
		console.error('[liberarAsientos] Error al liberar reservas expiradas:', err);
	}
}

liberarAsientosExpirados();
setInterval(liberarAsientosExpirados, 60 * 1000);

module.exports = liberarAsientosExpirados;
