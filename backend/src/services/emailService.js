const transporter = require('../config/mailer');

function buildComprobanteHtml({ to, reserva_id, nombre, dni, email, telefono, ruta, asiento, fecha_salida, monto, metodo_pago }) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Comprobante de reserva</title>
    </head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f5f7;color:#333;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#ffffff;border-collapse:collapse;">
        <tr>
          <td style="background-color:#1a237e;padding:22px 24px;text-align:left;color:#ffffff;">
            <h1 style="margin:0;font-size:24px;letter-spacing:1px;">Transportes Andinos</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:.85;">Comprobante de reserva</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:16px;color:#212121;">Estimado cliente, gracias por su reserva. A continuación encontrará los detalles de su comprobante.</p>
            <div style="background:#f1f3f8;border:1px solid #dde2eb;border-radius:12px;padding:18px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#5f6d85;text-transform:uppercase;letter-spacing:.05em;font-weight:700;">Reserva</p>
              <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#1a237e;">${reserva_id}</p>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
              <tbody>
                <tr>
                  <td style="padding:10px 0;font-size:14px;color:#5f6d85;border-bottom:1px solid #e6e9f0;width:45%;"><strong>Ruta</strong></td>
                  <td style="padding:10px 0;font-size:14px;color:#212121;border-bottom:1px solid #e6e9f0;">${ruta || 'No disponible'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:14px;color:#5f6d85;border-bottom:1px solid #e6e9f0;"><strong>Asiento</strong></td>
                  <td style="padding:10px 0;font-size:14px;color:#212121;border-bottom:1px solid #e6e9f0;">${asiento || 'No disponible'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:14px;color:#5f6d85;border-bottom:1px solid #e6e9f0;"><strong>Fecha de salida</strong></td>
                  <td style="padding:10px 0;font-size:14px;color:#212121;border-bottom:1px solid #e6e9f0;">${fecha_salida || 'No disponible'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:14px;color:#5f6d85;border-bottom:1px solid #e6e9f0;"><strong>Monto pagado</strong></td>
                  <td style="padding:10px 0;font-size:14px;color:#212121;border-bottom:1px solid #e6e9f0;">S/ ${Number(monto || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:14px;color:#5f6d85;"><strong>Método de pago</strong></td>
                  <td style="padding:10px 0;font-size:14px;color:#212121;">${metodo_pago || 'No especificado'}</td>
                </tr>
              </tbody>
            </table>

            <div style="background:#f1f3f8;border:1px solid #dde2eb;border-radius:12px;padding:18px;">
              <p style="margin:0 0 8px;font-size:14px;color:#5f6d85;font-weight:700;">Pasajero</p>
              <p style="margin:0;font-size:14px;color:#212121;"><strong>Nombre:</strong> ${nombre || 'No disponible'}</p>
              <p style="margin:6px 0 0;font-size:14px;color:#212121;"><strong>DNI:</strong> ${dni || 'No disponible'}</p>
              <p style="margin:6px 0 0;font-size:14px;color:#212121;"><strong>Teléfono:</strong> ${telefono || 'No disponible'}</p>
              <p style="margin:6px 0 0;font-size:14px;color:#212121;"><strong>Email:</strong> ${email || 'No disponible'}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#eef1fb;padding:20px 24px;text-align:center;color:#5f6d85;font-size:13px;">
            Gracias por viajar con Transportes Andinos
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

async function enviarComprobante({ to, reserva_id, nombre, dni, email, telefono, ruta, asiento, fecha_salida, monto, metodo_pago }) {
  if (!to) {
    throw new Error('El destinatario del correo es obligatorio.');
  }

  const html = buildComprobanteHtml({ to, reserva_id, nombre, dni, email, telefono, ruta, asiento, fecha_salida, monto, metodo_pago });

  const info = await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject: `Comprobante de reserva ${reserva_id}`,
    html,
  });

  return info;
}

module.exports = { enviarComprobante };
