import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

// ── unchanged logic helpers ────────────────────────────────
function formatCountdown(targetTime) {
  if (!targetTime) return '';

  const remainingMs = new Date(targetTime).getTime() - Date.now();
  if (Number.isNaN(remainingMs)) return '';
  if (remainingMs <= 0) return '00:00';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(value) {
  if (!value) return 'Fecha no disponible';

  const date = new Date(value);
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getServiceIconList(bus = {}) {
  return [
    { key: 'tiene_wifi', icon: '📶', label: 'WiFi' },
    { key: 'tiene_tv', icon: '📺', label: 'TV' },
    { key: 'tiene_usb', icon: '🔌', label: 'USB' },
    { key: 'tiene_bano', icon: '🚻', label: 'Baño' },
    { key: 'tiene_aire', icon: '❄️', label: 'Aire' },
  ].filter((service) => Boolean(bus[service.key]));
}

function getSeatTypeMeta(tipoAsiento) {
  const meta = {
    normal: { icon: '💺', label: 'Normal' },
    'semi-reclinable': { icon: '🪑', label: 'Semi-reclinable' },
    'reclinable-180': { icon: '🛏️', label: 'Reclinable 180°' },
  };

  return meta[String(tipoAsiento || 'semi-reclinable')] || meta['semi-reclinable'];
}

function getServiceLevelMeta(nivelServicio) {
  const meta = {
    economico: { label: 'Económico', backgroundColor: '#1a237e', color: '#ffffff' },
    ejecutivo: { label: 'Ejecutivo', backgroundColor: '#6a1b9a', color: '#ffffff' },
    vip: { label: 'VIP', backgroundColor: '#f57f17', color: '#000000' },
  };

  return meta[String(nivelServicio || 'economico')] || meta.economico;
}

// ── seat map helpers ───────────────────────────────────────
const SEAT_COLORS = {
  disponible: '#4caf50',
  reservado:  '#ff9800',
  pagado:     '#f44336',
  liberado:   '#4caf50',
};

const SEAT_LABELS = {
  disponible: 'Disponible',
  reservado:  'Reservado',
  pagado:     'Pagado',
  liberado:   'Liberado',
};

const LEGEND = ['disponible', 'reservado', 'pagado', 'liberado'].map(e => ({
  estado: e,
  color:  SEAT_COLORS[e],
  label:  SEAT_LABELS[e],
}));

function buildSeatLayout(seats) {
  const seatMap = new Map();
  let maxRow = 0;
  let maxCol = 0;

  for (const seat of seats) {
    const row = Number(seat?.fila ?? 0);
    const col = Number(seat?.columna ?? 0);

    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;

    seatMap.set(`${row}-${col}`, seat);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  }

  return {
    seatMap,
    rows: Array.from({ length: maxRow || 1 }, (_, index) => index + 1),
    cols: Array.from({ length: maxCol || 1 }, (_, index) => index + 1),
  };
}

// ── BusMap component ───────────────────────────────────────
function BusMap({ seats, tarifas = [], submittingId, onSelect, asientosSeleccionados = [] }) {
  const filasUnicas = [...new Set(seats.map((s) => Number(s?.fila ?? 0)).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  const filaIndex = filasUnicas.reduce((acc, fila, index) => {
    acc[fila] = index + 1;
    return acc;
  }, {});

  return (
    <div style={{
      backgroundColor: '#1a237e',
      borderRadius: '36px 36px 20px 20px',
      padding: '20px 24px 24px',
      width: 'fit-content',
      maxWidth: '100%',
      margin: '0 auto',
      boxShadow: '0 8px 40px rgba(26,35,126,.45)',
      maxHeight: '600px',
      overflowY: 'auto',
    }}>
      {/* Frente */}
      <div style={{
        textAlign: 'center',
        color: 'rgba(255,255,255,.6)',
        fontSize: '.7rem',
        fontWeight: 700,
        letterSpacing: '2.5px',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,.12)',
        paddingBottom: '12px',
        marginBottom: '12px',
      }}>
        🚌 Frente
      </div>

      {/* Seat grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 0.5fr 1fr 1fr',
        gridTemplateRows: `repeat(${Math.max(filasUnicas.length, 1)}, auto)`,
        gap: '6px',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '10px 0 8px',
        padding: '4px 0',
      }}>
        {seats.map((seat) => {
          const row = Number(seat?.fila ?? 0);
          const col = Number(seat?.columna ?? 0);
          const gridRowStart = filaIndex[row] || 1;
          const gridColStart = col > 2 ? col + 1 : col || 1;
          const estaSeleccionadoLocalmente = asientosSeleccionados.some(a => a.id === seat.id);
          let bgColor = SEAT_COLORS[seat.estado] ?? '#9e9e9e';
          if (estaSeleccionadoLocalmente) {
            bgColor = '#1a237e';
          }
          const label        = SEAT_LABELS[seat.estado] ?? seat.estado;
          const isAvailable  = seat.estado === 'disponible' || seat.estado === 'liberado';
          const isSubmitting = submittingId === seat.id;
          const showOrange   = isSubmitting;

          const tipoAsiento = seat?.tipo || 'normal';
          const tarifaMatch = tarifas.find(
            (t) => String(t.tipo_asiento).toLowerCase() === String(tipoAsiento).toLowerCase()
          );
          const precioAsiento = tarifaMatch?.precio
            ? Number(tarifaMatch.precio)
            : tarifas.length > 0
              ? Math.min(...tarifas.map((t) => Number(t.precio)))
              : 0;

          return (
            <button
              key={seat.id ?? `${row}-${col}`}
              type="button"
              disabled={!isAvailable || isSubmitting}
              onClick={() => onSelect(seat.id)}
              title={`Asiento ${seat.codigo || seat.numero} — ${label}`}
              style={{
                gridRowStart: gridRowStart,
                gridColumnStart: gridColStart,
                width: '44px',
                minHeight: '52px',
                height: 'auto',
                borderRadius: '8px',
                border: showOrange ? '3px solid #ff6f00' : estaSeleccionadoLocalmente ? '2px solid #ffffff' : '2px solid rgba(255,255,255,.12)',
                backgroundColor: bgColor,
                color: '#ffffff',
                fontSize: '.65rem',
                fontWeight: 800,
                cursor: isAvailable && !isSubmitting ? 'pointer' : 'default',
                opacity: isSubmitting ? .65 : 1,
                transition: 'transform .12s, box-shadow .12s',
                boxShadow: showOrange ? '0 0 0 2px rgba(255,111,0,.4)' : estaSeleccionadoLocalmente ? '0 0 0 2px rgba(26,35,126,.4)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 4px',
                lineHeight: 1,
                textAlign: 'center',
              }}
              onMouseEnter={e => {
                if (isAvailable && !isSubmitting) {
                  e.currentTarget.style.transform = 'scale(1.12)';
                  e.currentTarget.style.boxShadow = `0 4px 14px ${bgColor}99`;
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = showOrange ? '0 0 0 2px rgba(255,111,0,.4)' : estaSeleccionadoLocalmente ? '0 0 0 2px rgba(26,35,126,.4)' : 'none';
              }}
            >
              {isSubmitting ? '…' : (
                <>
                  <div style={{ fontSize: '.75rem', fontWeight: 700 }}>{seat.codigo || seat.numero || `${row}-${col}`}</div>
                  {isAvailable && (
                    <div style={{ fontSize: '.62rem', opacity: 0.85 }}>
                      S/{precioAsiento.toFixed(0)}
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Puerta */}
      <div style={{
        textAlign: 'center',
        color: 'rgba(255,255,255,.6)',
        fontSize: '.7rem',
        fontWeight: 700,
        letterSpacing: '2.5px',
        textTransform: 'uppercase',
        borderTop: '1px solid rgba(255,255,255,.12)',
        paddingTop: '12px',
        marginTop: '12px',
      }}>
        🚪 Puerta
      </div>
    </div>
  );
}

export { BusMap };

// ── Page ───────────────────────────────────────────────────
export default function AsientosPage() {
  const navigate = useNavigate();
  const { viaje_id } = useParams();
  const [asientos, setAsientos] = useState([]);
  const [viaje, setViaje] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [reservaExpiraEn, setReservaExpiraEn] = useState('');
  const [countdown, setCountdown] = useState('');
  const [lastReserva, setLastReserva] = useState(null);
  const [activePiso, setActivePiso] = useState(1);
  const [asientosSeleccionados, setAsientosSeleccionados] = useState([]);

  // Derive num_pisos from seat data
  const numPisos = asientos.some(a => a.piso === 2) ? 2 : 1;
  const seatsForPiso = asientos.filter(a => (a.piso ?? 1) === activePiso);
  const availableCount = seatsForPiso.filter(a => a.estado === 'disponible').length;
  const viajeRuta = viaje?.ruta || {};
  const tarifas = viajeRuta.tarifas || [];
  const bus = viaje?.bus || {};
  const serviceLevelMeta = getServiceLevelMeta(bus.nivel_servicio);
  const seatTypeMeta = getSeatTypeMeta(bus.tipo_asiento);
  const busServices = getServiceIconList(bus);

  useEffect(() => {
    let active = true;

    async function loadAsientos() {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get(`/api/asientos/${viaje_id}`);
        if (!active) return;

        if (Array.isArray(data)) {
          setAsientos(data);
          setViaje(null);
        } else {
          setAsientos(Array.isArray(data?.asientos) ? data.asientos : []);
          setViaje(data?.viaje || null);
        }
      } catch (fetchError) {
        if (active) {
          setAsientos([]);
          setViaje(null);
          setError(fetchError?.response?.data?.message || 'No se pudieron cargar los asientos.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAsientos();

    return () => {
      active = false;
    };
  }, [viaje_id]);

  useEffect(() => {
    if (!reservaExpiraEn) {
      return undefined;
    }

    function updateCountdown() {
      setCountdown(formatCountdown(reservaExpiraEn));
    }

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(intervalId);
  }, [reservaExpiraEn]);

  async function handleSelectSeat(asientoId) {
    const asientoSeleccionado = asientos.find((a) => a.id === asientoId);
    if (!asientoSeleccionado || asientoSeleccionado.estado !== 'disponible') return;

    setAsientosSeleccionados((prev) => {
      const yaSeleccionado = prev.find((a) => a.id === asientoId);
      if (yaSeleccionado) {
        // Deseleccionar
        return prev.filter((a) => a.id !== asientoId);
      }
      // Seleccionar — máximo 5 asientos
      if (prev.length >= 5) {
        setError('Máximo 5 asientos por compra.');
        return prev;
      }
      const tarifas = viaje?.ruta?.tarifas || [];
      const tipoAsiento = asientoSeleccionado?.tipo || 'normal';
      const tarifaMatch = tarifas.find(
        (t) => String(t.tipo_asiento).toLowerCase() === String(tipoAsiento).toLowerCase()
      );
      const precio = tarifaMatch?.precio
        ? Number(tarifaMatch.precio)
        : tarifas.length > 0
          ? Math.min(...tarifas.map((t) => Number(t.precio)))
          : 0;
      return [...prev, {
        id: asientoSeleccionado.id,
        codigo: asientoSeleccionado.codigo,
        tipo: tipoAsiento,
        precio,
      }];
    });
  }

  async function handleConfirmarSeleccion() {
    if (asientosSeleccionados.length === 0) return;
    setSubmittingId('confirming');
    setError('');
    try {
      const reservas = [];
      for (const asiento of asientosSeleccionados) {
        const { data } = await api.post('/api/asientos/seleccionar', {
          viaje_id,
          asiento_id: asiento.id,
          pasajero_id: 1,
        });
        if (data?.reserva_id) {
          reservas.push({
            reserva_id: data.reserva_id,
            expira_en: data.expira_en,
            asiento: asiento,
          });
        }
      }

      const montoTotal = asientosSeleccionados.reduce((sum, a) => sum + a.precio, 0);
      const primeraExpiracion = reservas[0]?.expira_en || '';

      navigate('/pago', {
        state: {
          reservas,
          reserva_id: reservas[0]?.reserva_id,
          expira_en: primeraExpiracion,
          asientos: asientosSeleccionados,
          asiento: asientosSeleccionados[0] || {},
          viaje: {
            origen: viaje?.ruta?.origen || '',
            destino: viaje?.ruta?.destino || '',
            fecha_salida: viaje?.fecha_salida || '',
            ruta_nombre: viaje?.ruta?.nombre || '',
          },
          viaje_id,
          monto: montoTotal,
        },
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al reservar los asientos.');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div style={{ flex: 1, backgroundColor: '#f8f9fa', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #121858 0%, #1a237e 100%)',
        padding: '2rem 0',
        marginBottom: '2.5rem',
      }}>
        <div className="container">
          <h1 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 800, marginBottom: '.3rem' }}>
            Selección de asientos
          </h1>
          <p style={{ color: 'rgba(255,255,255,.6)', margin: 0, fontSize: '.9rem' }}>
            Viaje #{viaje_id} · Haz clic en un asiento verde para reservarlo
          </p>
        </div>
      </div>

      <div className="container">
        {viaje ? (
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
            <div className="card-body p-4">
              <div className="row g-3 align-items-center">
                <div className="col-12 col-lg-5">
                  <div className="text-uppercase text-muted small fw-semibold mb-1">Ruta</div>
                  <div className="h5 mb-0" style={{ color: '#1a237e', fontWeight: 800 }}>
                    {viajeRuta.origen || 'Origen'} → {viajeRuta.destino || 'Destino'}
                  </div>
                  <div className="text-muted small mt-1">{viajeRuta.nombre || 'Ruta sin nombre'}</div>
                </div>

                <div className="col-12 col-md-6 col-lg-3">
                  <div className="text-uppercase text-muted small fw-semibold mb-1">Salida</div>
                  <div className="fw-semibold">{formatDateTime(viaje.fecha_salida)}</div>
                </div>

                <div className="col-12 col-md-6 col-lg-4 d-flex justify-content-lg-end">
                  <span
                    className="badge px-3 py-2"
                    style={{
                      backgroundColor: serviceLevelMeta.backgroundColor,
                      color: serviceLevelMeta.color,
                      borderRadius: '999px',
                      fontSize: '.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {serviceLevelMeta.label}
                  </span>
                </div>

                <div className="col-12">
                  <div className="d-flex flex-wrap align-items-start gap-3">
                    <span className="text-muted small fw-semibold">Servicios:</span>
                    {busServices.length > 0 ? busServices.map((service) => (
                      <div key={service.key} className="d-flex flex-column align-items-center text-center" style={{ minWidth: '48px' }}>
                        <span className="badge text-bg-light border text-dark d-inline-flex align-items-center justify-content-center" title={service.label} style={{ width: '34px', height: '34px' }}>
                          {service.icon}
                        </span>
                        <span className="text-muted" style={{ fontSize: '.72rem', lineHeight: 1.1, marginTop: '4px' }}>
                          {service.label}
                        </span>
                      </div>
                    )) : <span className="text-muted small">Sin servicios registrados</span>}
                  </div>
                </div>

                <div className="col-12">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="text-muted small fw-semibold">Asiento:</span>
                    <span className="badge text-bg-light border text-dark">
                      {seatTypeMeta.icon} {seatTypeMeta.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-danger mb-4" role="alert">{error}</div>
        ) : null}

        <div className="d-flex justify-content-center">
          <div
            className="card border-0"
            style={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', minWidth: '320px' }}
          >
            <div className="card-body p-4">
              {/* Available count */}
              {!loading && asientos.length > 0 ? (
                <>
                  <div style={{
                    background: '#fff3e0',
                    border: '1px solid #ffb74d',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1.5rem',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 700, color: '#e65100' }}>💰 Precios por tipo de asiento:</span>
                    {(tarifas || []).map((t) => (
                      <span key={t.id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '.4rem',
                        fontWeight: 600,
                        color: '#5d4037'
                      }}>
                        {String(t.tipo_asiento).toLowerCase() === 'vip' ? '👑' : '💺'}
                        {String(t.tipo_asiento).toUpperCase()}: S/ {Number(t.precio).toFixed(2)}
                      </span>
                    ))}
                  </div>

                  <div className="text-center mb-3">
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: '#e8f5e9',
                      color: '#2e7d32',
                      borderRadius: '999px',
                      padding: '4px 14px',
                      fontSize: '.8rem',
                      fontWeight: 600,
                    }}>
                      {availableCount} {availableCount === 1 ? 'asiento disponible' : 'asientos disponibles'}
                    </span>
                  </div>
                </>
              ) : null}

              {/* Floor tabs — only for 2-floor buses */}
              {!loading && numPisos === 2 ? (
                <div className="d-flex gap-2 justify-content-center mb-4">
                  {[1, 2].map(piso => (
                    <button
                      key={piso}
                      type="button"
                      className="btn btn-sm fw-semibold"
                      style={{
                        backgroundColor: activePiso === piso ? '#1a237e' : 'transparent',
                        color: activePiso === piso ? '#ffffff' : '#1a237e',
                        borderColor: '#1a237e',
                        borderRadius: '6px',
                        padding: '6px 22px',
                        transition: 'all .2s',
                      }}
                      onClick={() => setActivePiso(piso)}
                    >
                      Piso {piso}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Map or spinner */}
              {loading ? (
                <div className="d-flex justify-content-center py-5">
                  <div className="text-center">
                    <div
                      className="spinner-border"
                      role="status"
                      aria-hidden="true"
                      style={{ color: '#ff6f00', width: '2.5rem', height: '2.5rem' }}
                    />
                    <div className="mt-3 fw-semibold" style={{ color: '#6c757d', fontSize: '.9rem' }}>
                      Cargando asientos...
                    </div>
                  </div>
                </div>
              ) : asientos.length === 0 ? (
                <div className="alert alert-info mb-0">No hay asientos para mostrar.</div>
              ) : (
                <BusMap
                  seats={seatsForPiso}
                  tarifas={tarifas}
                  submittingId={submittingId}
                  onSelect={handleSelectSeat}
                  asientosSeleccionados={asientosSeleccionados}
                />
              )}

              {/* Legend */}
              {!loading && asientos.length > 0 ? (
                <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                  {LEGEND.map(({ estado, color, label }) => (
                    <div key={estado} className="d-flex align-items-center gap-1">
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '4px',
                        backgroundColor: color,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '.75rem', color: '#6c757d', fontWeight: 500 }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Sticky panel para asientos seleccionados */}
        {asientosSeleccionados.length > 0 ? (
          <div style={{
            position: 'sticky',
            bottom: 0,
            background: '#fff',
            borderTop: '2px solid #e9ecef',
            padding: '1rem',
            borderRadius: '0 0 16px 16px',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
            marginTop: '2rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
              <span style={{ fontWeight: 700 }}>
                {asientosSeleccionados.length} asiento(s) seleccionado(s):
                {' '}{asientosSeleccionados.map(a => a.codigo).join(', ')}
              </span>
              <span style={{ fontWeight: 800, color: '#1a237e', fontSize: '1.1rem' }}>
                Total: S/ {asientosSeleccionados.reduce((sum, a) => sum + a.precio, 0).toFixed(2)}
              </span>
            </div>
            <button
              className="btn w-100"
              style={{ background: '#f57c00', color: '#fff', fontWeight: 700, borderRadius: '10px' }}
              onClick={handleConfirmarSeleccion}
              disabled={submittingId === 'confirming'}
            >
              {submittingId === 'confirming' ? 'Procesando...' : 'Continuar al pago →'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
