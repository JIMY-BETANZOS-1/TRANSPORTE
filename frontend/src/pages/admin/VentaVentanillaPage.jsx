import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { BusMap } from '../AsientosPage';

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getSeatPrice(seat, tarifas = []) {
  const tipoAsiento = seat?.tipo || 'normal';
  const tarifaMatch = tarifas.find(
    (t) => String(t.tipo_asiento).toLowerCase() === String(tipoAsiento).toLowerCase()
  );
  return tarifaMatch?.precio ? Number(tarifaMatch.precio) : tarifas.length > 0
    ? Math.min(...tarifas.map((t) => Number(t.precio)))
    : 0;
}

export default function VentaVentanillaPage() {
  const navigate = useNavigate();
  const { viaje_id } = useParams();

  const [asientos, setAsientos] = useState([]);
  const [viaje, setViaje] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [asientosSeleccionados, setAsientosSeleccionados] = useState([]);
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');

  const tarifas = viaje?.ruta?.tarifas || [];
  const seatsForPiso = asientos.filter((seat) => (seat.piso ?? 1) === 1);

  const total = useMemo(
    () => asientosSeleccionados.reduce((sum, seat) => sum + getSeatPrice(seat, tarifas), 0),
    [asientosSeleccionados, tarifas]
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get(`/api/asientos/${viaje_id}`);
        if (!active) return;

        setAsientos(Array.isArray(data?.asientos) ? data.asientos : []);
        setViaje(data?.viaje || null);
      } catch (fetchError) {
        if (active) {
          setError(fetchError?.response?.data?.message || 'No se pudieron cargar los asientos.');
          setAsientos([]);
          setViaje(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [viaje_id]);

  function handleSelectSeat(seatId) {
    const seat = asientos.find((item) => String(item.id) === String(seatId));
    if (!seat) return;
    if (seat.estado !== 'disponible' && seat.estado !== 'liberado') return;

    const alreadySelected = asientosSeleccionados.some((item) => String(item.id) === String(seat.id));
    if (alreadySelected) {
      setAsientosSeleccionados((current) => current.filter((item) => String(item.id) !== String(seat.id)));
      return;
    }

    if (asientosSeleccionados.length >= 5) {
      setError('Solo puedes seleccionar hasta 5 asientos.');
      return;
    }

    setError('');
    setAsientosSeleccionados((current) => [...current, seat]);
  }

  async function handleConfirmarVenta() {
    if (!viaje) return;
    if (!asientosSeleccionados.length) {
      setError('Selecciona al menos un asiento.');
      return;
    }
    if (!nombre.trim() || !dni.trim() || !email.trim() || !telefono.trim()) {
      setError('Completa todos los datos del pasajero.');
      return;
    }
    if (!/^[0-9]{8}$/.test(dni)) {
      setError('DNI debe tener 8 dígitos.');
      return;
    }
    if (!/^[0-9]{9}$/.test(telefono)) {
      setError('Teléfono debe tener 9 dígitos.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const reservas = [];

      for (const asiento of asientosSeleccionados) {
        const { data } = await api.post('/api/asientos/seleccionar', {
          viaje_id: Number(viaje_id),
          asiento_id: Number(asiento.id),
        });
        reservas.push({ reserva_id: data.reserva_id, asiento });
      }

      for (const reserva of reservas) {
        await api.post('/api/pagos/confirmar-efectivo', {
          reserva_id: Number(reserva.reserva_id),
          nombre,
          dni,
          email,
          telefono,
          monto: getSeatPrice(reserva.asiento, tarifas),
          asiento: reserva.asiento.codigo,
          ruta: `${viaje.ruta.origen} → ${viaje.ruta.destino}`,
          fecha_salida: viaje.fecha_salida,
          metodo_pago: 'efectivo',
        });
      }

      alert('✅ Venta confirmada exitosamente');
      navigate('/admin/viajes');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al confirmar la venta.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container py-5">
        <div className="text-center">Cargando venta en ventanilla...</div>
      </div>
    );
  }

  if (!viaje) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">No se encontró el viaje seleccionado.</div>
      </div>
    );
  }

  return (
    <div className="container py-4 py-md-5">
      <div className="mb-4 d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Venta en ventanilla — Viaje #{viaje_id}</h2>
          <p style={{ margin: 0, color: '#6c757d' }}>
            Ruta: {viaje.ruta.origen} → {viaje.ruta.destino} | {formatDateTime(viaje.fecha_salida)}
          </p>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={() => navigate('/admin/viajes')}>
          Volver a viajes
        </button>
      </div>

      {error ? (
        <div className="alert alert-danger">{error}</div>
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card border-0" style={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
            <div className="card-body p-4">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Mapa de asientos</h3>
              <BusMap
                seats={seatsForPiso}
                tarifas={tarifas}
                onSelect={handleSelectSeat}
                asientosSeleccionados={asientosSeleccionados}
                submittingId={null}
              />
              <div style={{ marginTop: '1rem', color: '#6c757d', fontSize: '.9rem' }}>
                Selecciona hasta 5 asientos disponibles.
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="card border-0" style={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
            <div className="card-body p-4">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Resumen de venta</h3>

              <div style={{ marginBottom: '1rem' }}>
                <strong>Asientos:</strong>{' '}
                {asientosSeleccionados.length > 0
                  ? asientosSeleccionados.map((a) => a.codigo).join(', ')
                  : 'No hay asientos seleccionados'}
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <strong>Total:</strong>{' '}
                S/ {total.toFixed(2)}
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600 }}>Nombre completo</label>
                <input
                  type="text"
                  className="form-control"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Nombre completo"
                  style={{ borderRadius: '8px', padding: '.65rem .9rem' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600 }}>DNI (8 dígitos)</label>
                <input
                  type="text"
                  className="form-control"
                  value={dni}
                  onChange={(event) => setDni(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="12345678"
                  maxLength={8}
                  style={{ borderRadius: '8px', padding: '.65rem .9rem' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600 }}>Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="correo@dominio.com"
                  style={{ borderRadius: '8px', padding: '.65rem .9rem' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600 }}>Teléfono (9 dígitos)</label>
                <input
                  type="tel"
                  className="form-control"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="999888777"
                  maxLength={9}
                  style={{ borderRadius: '8px', padding: '.65rem .9rem' }}
                />
              </div>

              <button
                type="button"
                className="btn btn-success w-100"
                style={{ borderRadius: '10px', fontWeight: 700, padding: '.85rem' }}
                disabled={submitting || asientosSeleccionados.length === 0}
                onClick={handleConfirmarVenta}
              >
                {submitting ? 'Confirmando venta...' : '✅ Confirmar venta (Efectivo)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
