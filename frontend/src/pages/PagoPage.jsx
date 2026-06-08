import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

function formatCountdown(targetTime) {
  if (!targetTime) return '00:00';

  const remainingMs = new Date(targetTime).getTime() - Date.now();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return '00:00';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatMoney(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return 'S/ 0.00';

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount);
}

function formatCardNumber(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function formatCardExpiry(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectCardBrand(cardNumber) {
  const firstDigit = String(cardNumber || '').replace(/\D/g, '').charAt(0);
  if (firstDigit === '4') return 'visa';
  if (firstDigit === '5') return 'mastercard';
  return 'unknown';
}

function getMethodMeta(metodo) {
  if (metodo === 'yape') {
    return {
      title: 'Yape',
      accent: '#7b1fa2',
      background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
      instruction: 'Abre Yape, escanea el QR y confirma el pago',
      buttonLabel: 'Ya pagué con Yape',
      qrLabel: 'Yape QR',
    };
  }

  if (metodo === 'plin') {
    return {
      title: 'Plin',
      accent: '#1565c0',
      background: 'linear-gradient(135deg, #0d47a1 0%, #26a69a 100%)',
      instruction: 'Abre Plin, escanea el QR y confirma el pago',
      buttonLabel: 'Ya pagué con Plin',
      qrLabel: 'Plin QR',
    };
  }

  return {
    title: 'Tarjeta Débito/Crédito',
    accent: '#1a237e',
    background: 'linear-gradient(135deg, #1a237e 0%, #283593 55%, #0d47a1 100%)',
    instruction: 'Ingresa los datos de tu tarjeta para continuar',
    buttonLabel: 'Confirmar pago con tarjeta',
    qrLabel: '',
  };
}

function getBrandLabel(brand) {
  if (brand === 'visa') return 'VISA';
  if (brand === 'mastercard') return 'Mastercard';
  return 'Pago seguro';
}

const BTN_ORANGE = {
  base: {
    backgroundColor: '#ff6f00',
    borderColor: '#ff6f00',
    color: '#ffffff',
    borderRadius: '6px',
    fontWeight: 600,
    transition: 'background-color .2s, box-shadow .2s',
  },
  hover: { backgroundColor: '#e65100', borderColor: '#e65100' },
  leave: { backgroundColor: '#ff6f00', borderColor: '#ff6f00' },
};

export default function PagoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reserva_id: reservaIdParam } = useParams();

  const state = location.state || {};
  const reservaIdFromState = state.reserva_id ?? '';
  const reservaId = reservaIdFromState || reservaIdParam || '';
  const expiraEn = state.expira_en || state.expiraEn || '';
  const asiento = state.asiento || {};
  const viaje = state.viaje || {};
  const montoRaw = state.monto ?? 0;

  const [countdown, setCountdown] = useState(formatCountdown(expiraEn));
  const [metodo, setMetodo] = useState('culqi');
  const [datosPasajero, setDatosPasajero] = useState({
    nombre: '',
    dni: '',
    email: '',
    telefono: '',
  });
  const [datosTarjeta, setDatosTarjeta] = useState({
    numero: '',
    nombre: '',
    expiracion: '',
    cvv: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const summary = useMemo(
    () => ({
      origenDestino: viaje.origen && viaje.destino ? `${viaje.origen} → ${viaje.destino}` : 'Resumen no disponible',
      asiento: asiento.codigo || asiento.numero || asiento.id || 'Asiento no disponible',
      monto: formatMoney(montoRaw),
    }),
    [asiento.codigo, asiento.id, asiento.numero, montoRaw, viaje.destino, viaje.origen]
  );

  const methodMeta = getMethodMeta(metodo);
  const cardBrand = detectCardBrand(datosTarjeta.numero);
  const cardBrandLabel = getBrandLabel(cardBrand);
  const shouldShowCardForm = metodo === 'culqi';
  const shouldShowQrPayment = metodo === 'yape' || metodo === 'plin';

  useEffect(() => {
    if (!expiraEn) return undefined;

    function updateCountdown() {
      setCountdown(formatCountdown(expiraEn));
    }

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(intervalId);
  }, [expiraEn]);

  function handlePassengerChange(event) {
    const { name, value } = event.target;
    setDatosPasajero((current) => ({ ...current, [name]: value }));
  }

  function handleCardChange(event) {
    const { name, value } = event.target;

    if (name === 'numero') {
      setDatosTarjeta((current) => ({ ...current, numero: formatCardNumber(value) }));
      return;
    }

    if (name === 'expiracion') {
      setDatosTarjeta((current) => ({ ...current, expiracion: formatCardExpiry(value) }));
      return;
    }

    if (name === 'cvv') {
      setDatosTarjeta((current) => ({ ...current, cvv: String(value).replace(/\D/g, '').slice(0, 3) }));
      return;
    }

    setDatosTarjeta((current) => ({ ...current, [name]: value }));
  }

  async function submitPayment() {
    setError('');

    if (!reservaIdFromState) {
      setError('No se encontró reserva_id en location.state para procesar el pago.');
      return;
    }

    const monto = parseFloat(montoRaw);
    if (Number.isNaN(monto)) {
      setError('El monto de pago es inválido.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        reserva_id: reservaIdFromState,
        metodo: String(metodo).toLowerCase(),
        monto,
        datos_pasajero: {
          nombre: datosPasajero.nombre,
          dni: datosPasajero.dni,
          email: datosPasajero.email,
          telefono: datosPasajero.telefono,
        },
      };

      console.log('POST /api/pagos body:', payload);

      const { data } = await api.post('/api/pagos', payload);
      setConfirmation({
        reservaId: data?.codigo_reserva || data?.reserva_id || reservaIdFromState,
        message: data?.message || 'Pago confirmado correctamente.',
      });
    } catch (paymentError) {
      setError(paymentError?.response?.data?.message || 'No se pudo confirmar el pago.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitPayment();
  }

  // ── Pantalla de confirmación ───────────────────────────────
  if (confirmation) {
    return (
      <div style={{ flex: 1, backgroundColor: '#f8f9fa', paddingBottom: '3rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #121858 0%, #1a237e 100%)',
          padding: '2rem 0',
          marginBottom: '2.5rem',
        }}>
          <div className="container">
            <h1 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 800, marginBottom: '.3rem' }}>
              Confirmación de pago
            </h1>
            <p style={{ color: 'rgba(255,255,255,.6)', margin: 0, fontSize: '.9rem' }}>
              Transportes Andinos — tu reserva está confirmada
            </p>
          </div>
        </div>

        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-sm-10 col-md-8 col-lg-6">
              <div
                className="card border-0 text-center"
                style={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}
              >
                <div className="card-body p-4 p-md-5">
                  <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: '1rem' }}>🎉</div>
                  <div
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#e8f5e9',
                      color: '#2e7d32',
                      borderRadius: '999px',
                      padding: '4px 16px',
                      fontSize: '.8rem',
                      fontWeight: 700,
                      letterSpacing: '.5px',
                      textTransform: 'uppercase',
                      marginBottom: '1rem',
                    }}
                  >
                    ✓ Pago exitoso
                  </div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a237e', marginBottom: '.75rem' }}>
                    {confirmation.message}
                  </h2>
                  <div
                    style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '10px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <p style={{ fontSize: '.8rem', color: '#6c757d', margin: '0 0 .25rem' }}>
                      Código de reserva
                    </p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1a237e', margin: 0, letterSpacing: '1px' }}>
                      {confirmation.reservaId}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn fw-semibold"
                    style={{ ...BTN_ORANGE.base, padding: '.65rem 2rem' }}
                    onMouseEnter={e => Object.assign(e.currentTarget.style, BTN_ORANGE.hover)}
                    onMouseLeave={e => Object.assign(e.currentTarget.style, BTN_ORANGE.leave)}
                    onClick={() => navigate('/buscar')}
                  >
                    Buscar otro viaje
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla principal ─────────────────────────────────────
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
            Pago de reserva
          </h1>
          <p style={{ color: 'rgba(255,255,255,.6)', margin: 0, fontSize: '.9rem' }}>
            Completa los datos del pasajero para confirmar tu viaje
          </p>
        </div>
      </div>

      <div className="container">
        {error ? (
          <div className="alert alert-danger mb-4" role="alert">{error}</div>
        ) : null}

        <div className="row g-4 justify-content-center">

          {/* ── Resumen ────────────────────────────────────── */}
          <div className="col-12 col-lg-4">
            <div
              className="card border-0 h-100"
              style={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}
            >
              <div className="card-body p-4">
                <h2
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#1a237e',
                    marginBottom: '1.25rem',
                    paddingBottom: '.75rem',
                    borderBottom: '2px solid #f1f3f5',
                  }}
                >
                  📋 Resumen de reserva
                </h2>

                <dl style={{ margin: 0 }}>
                  {[
                    { label: '🎟️ Reserva',    value: reservaId || 'No disponible' },
                    { label: '🗺️ Ruta',        value: summary.origenDestino        },
                    { label: '💺 Asiento',     value: summary.asiento              },
                  ].map(({ label, value }) => (
                    <div key={label} className="mb-3">
                      <dt style={{ fontSize: '.75rem', color: '#6c757d', fontWeight: 600, marginBottom: '.15rem' }}>
                        {label}
                      </dt>
                      <dd style={{ fontSize: '.95rem', fontWeight: 600, color: '#212529', margin: 0 }}>
                        {value}
                      </dd>
                    </div>
                  ))}

                  <div className="mb-3">
                    <dt style={{ fontSize: '.75rem', color: '#6c757d', fontWeight: 600, marginBottom: '.15rem' }}>
                      💰 Monto total
                    </dt>
                    <dd style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ff6f00', margin: 0 }}>
                      {summary.monto}
                    </dd>
                  </div>

                  <div
                    style={{
                      backgroundColor: countdown === '00:00' ? '#fff3e0' : '#e3f2fd',
                      borderRadius: '8px',
                      padding: '.65rem .9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '.8rem', color: '#6c757d', fontWeight: 500 }}>
                      ⏱ Tiempo restante
                    </span>
                    <span style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: countdown === '00:00' ? '#e65100' : '#1565c0',
                      letterSpacing: '1px',
                    }}>
                      {countdown}
                    </span>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* ── Formulario ─────────────────────────────────── */}
          <div className="col-12 col-lg-7">
            <div
              className="card border-0"
              style={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}
            >
              <div className="card-body p-4">
                <h2
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#1a237e',
                    marginBottom: '1.25rem',
                    paddingBottom: '.75rem',
                    borderBottom: '2px solid #f1f3f5',
                  }}
                >
                  👤 Datos del pasajero
                </h2>

                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-12">
                      <label htmlFor="nombre" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                        Nombre completo
                      </label>
                      <input
                        id="nombre"
                        name="nombre"
                        type="text"
                        className="form-control"
                        style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                        value={datosPasajero.nombre}
                        onChange={handlePassengerChange}
                        placeholder="Juan Pérez García"
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label htmlFor="dni" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                        DNI
                      </label>
                      <input
                        id="dni"
                        name="dni"
                        type="text"
                        className="form-control"
                        style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                        value={datosPasajero.dni}
                        onChange={handlePassengerChange}
                        placeholder="12345678"
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label htmlFor="email" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className="form-control"
                        style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                        value={datosPasajero.email}
                        onChange={handlePassengerChange}
                        placeholder="correo@ejemplo.com"
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label htmlFor="telefono" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                        Teléfono
                      </label>
                      <input
                        id="telefono"
                        name="telefono"
                        type="tel"
                        className="form-control"
                        style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                        value={datosPasajero.telefono}
                        onChange={handlePassengerChange}
                        placeholder="999 888 777"
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label htmlFor="metodo" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                        Método de pago
                      </label>
                      <select
                        id="metodo"
                        className="form-select"
                        style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                        value={metodo}
                        onChange={(event) => setMetodo(event.target.value)}
                      >
                        <option value="culqi">💳 Tarjeta Débito/Crédito</option>
                        <option value="yape">📱 Yape</option>
                        <option value="plin">📲 Plin</option>
                      </select>
                    </div>

                    {shouldShowCardForm ? (
                      <div className="col-12">
                        <div
                          className="card border-0 text-white overflow-hidden"
                          style={{
                            borderRadius: '18px',
                            background: methodMeta.background,
                            boxShadow: '0 18px 40px rgba(26,35,126,.22)',
                          }}
                        >
                          <div className="card-body p-4">
                            <div className="row g-3 align-items-stretch">
                              <div className="col-12 col-md-5">
                                <div className="h-100 p-4 rounded-4 position-relative overflow-hidden" style={{ background: 'rgba(255,255,255,.08)', backdropFilter: 'blur(8px)' }}>
                                  <div className="d-flex justify-content-between align-items-start mb-4">
                                    <div>
                                      <div style={{ fontSize: '.72rem', letterSpacing: '2px', opacity: .8, textTransform: 'uppercase' }}>
                                        Tarjeta virtual
                                      </div>
                                      <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '.3rem' }}>
                                        {methodMeta.title}
                                      </div>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-light text-dark">{cardBrandLabel}</span>
                                      {cardBrand === 'visa' ? (
                                        <span className="badge" style={{ backgroundColor: '#1a237e', color: '#ffffff' }}>VISA</span>
                                      ) : cardBrand === 'mastercard' ? (
                                        <span className="badge" style={{ backgroundColor: '#ffffff', color: '#000000' }}>Mastercard</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div style={{ fontSize: '1.35rem', letterSpacing: '2px', fontWeight: 800, minHeight: '38px' }}>
                                    {datosTarjeta.numero || '1234 5678 9012 3456'}
                                  </div>

                                  <div className="d-flex justify-content-between gap-3 mt-4">
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: '.68rem', opacity: .75, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        Titular
                                      </div>
                                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {datosTarjeta.nombre || 'NOMBRE EN LA TARJETA'}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '.68rem', opacity: .75, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        Expira
                                      </div>
                                      <div style={{ fontWeight: 700 }}>
                                        {datosTarjeta.expiracion || 'MM/AA'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="col-12 col-md-7">
                                <div className="row g-3">
                                  <div className="col-12">
                                    <label htmlFor="numero" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                                      Número de tarjeta
                                    </label>
                                    <input
                                      id="numero"
                                      name="numero"
                                      type="text"
                                      inputMode="numeric"
                                      maxLength="19"
                                      className="form-control"
                                      style={{ borderRadius: '6px', padding: '.6rem .9rem', letterSpacing: '1px' }}
                                      value={datosTarjeta.numero}
                                      onChange={handleCardChange}
                                      placeholder="1234 5678 9012 3456"
                                    />
                                  </div>

                                  <div className="col-12">
                                    <label htmlFor="nombreTarjeta" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                                      Nombre en la tarjeta
                                    </label>
                                    <input
                                      id="nombreTarjeta"
                                      name="nombre"
                                      type="text"
                                      className="form-control"
                                      style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                                      value={datosTarjeta.nombre}
                                      onChange={handleCardChange}
                                      placeholder="JUAN PEREZ GARCIA"
                                    />
                                  </div>

                                  <div className="col-12 col-md-6">
                                    <label htmlFor="expiracion" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                                      Fecha de expiración
                                    </label>
                                    <input
                                      id="expiracion"
                                      name="expiracion"
                                      type="text"
                                      inputMode="numeric"
                                      maxLength="5"
                                      className="form-control"
                                      style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                                      value={datosTarjeta.expiracion}
                                      onChange={handleCardChange}
                                      placeholder="MM/AA"
                                    />
                                  </div>

                                  <div className="col-12 col-md-6">
                                    <label htmlFor="cvv" className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                                      CVV
                                    </label>
                                    <input
                                      id="cvv"
                                      name="cvv"
                                      type="password"
                                      inputMode="numeric"
                                      maxLength="3"
                                      className="form-control"
                                      style={{ borderRadius: '6px', padding: '.6rem .9rem' }}
                                      value={datosTarjeta.cvv}
                                      onChange={handleCardChange}
                                      placeholder="123"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {shouldShowQrPayment ? (
                      <div className="col-12">
                        <div
                          className="card border-0 overflow-hidden"
                          style={{
                            borderRadius: '18px',
                            background: methodMeta.background,
                            color: '#ffffff',
                            boxShadow: '0 18px 40px rgba(0,0,0,.16)',
                          }}
                        >
                          <div className="card-body p-4 p-md-5">
                            <div className="row g-4 align-items-center">
                              <div className="col-12 col-md-5 d-flex justify-content-center">
                                <div
                                  className="p-3 rounded-4"
                                  style={{
                                    width: '100%',
                                    maxWidth: '260px',
                                    background: 'rgba(255,255,255,.12)',
                                    backdropFilter: 'blur(8px)',
                                  }}
                                >
                                  <div
                                    className="rounded-4 d-flex align-items-center justify-content-center"
                                    style={{
                                      height: '220px',
                                      background: 'linear-gradient(135deg, rgba(255,255,255,.96) 0%, rgba(255,255,255,.88) 100%)',
                                      color: metodo === 'yape' ? '#7b1fa2' : '#1565c0',
                                      position: 'relative',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '1px' }}>
                                        {metodo === 'yape' ? 'YAPE' : 'PLIN'}
                                      </div>
                                      <div style={{ fontSize: '.82rem', fontWeight: 700, marginTop: '.4rem' }}>
                                        QR simulado
                                      </div>
                                      <div
                                        style={{
                                          width: '128px',
                                          height: '128px',
                                          margin: '1rem auto 0',
                                          borderRadius: '18px',
                                          border: '12px solid currentColor',
                                          backgroundImage: 'radial-gradient(circle at 25% 25%, currentColor 10%, transparent 11%), radial-gradient(circle at 75% 25%, currentColor 10%, transparent 11%), radial-gradient(circle at 25% 75%, currentColor 10%, transparent 11%), radial-gradient(circle at 75% 75%, currentColor 10%, transparent 11%), linear-gradient(90deg, currentColor 0 14%, transparent 14% 28%, currentColor 28% 42%, transparent 42% 56%, currentColor 56% 70%, transparent 70% 84%, currentColor 84% 100%), linear-gradient(180deg, currentColor 0 14%, transparent 14% 28%, currentColor 28% 42%, transparent 42% 56%, currentColor 56% 70%, transparent 70% 84%, currentColor 84% 100%)',
                                          opacity: .9,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="col-12 col-md-7">
                                <div className="d-flex flex-column gap-3">
                                  <div>
                                    <div style={{ fontSize: '.78rem', opacity: .8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                      {methodMeta.qrLabel}
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1.1 }}>
                                      {summary.monto}
                                    </div>
                                  </div>

                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-light text-dark px-3 py-2" style={{ borderRadius: '999px' }}>
                                      Destino: 999-888-777
                                    </span>
                                  </div>

                                  <p className="mb-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                                    {methodMeta.instruction}
                                  </p>

                                  <button
                                    type="button"
                                    className="btn btn-light fw-semibold align-self-start"
                                    style={{ borderRadius: '6px', padding: '.65rem 1.2rem', color: methodMeta.accent }}
                                    onClick={submitPayment}
                                  >
                                    {methodMeta.buttonLabel}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="col-12 d-grid mt-1">
                      <button
                        type="submit"
                        className="btn btn-lg fw-semibold"
                        style={{
                          ...BTN_ORANGE.base,
                          padding: '.75rem',
                          fontSize: '1rem',
                          opacity: loading || !reservaIdFromState ? .65 : 1,
                        }}
                        onMouseEnter={e => { if (!e.currentTarget.disabled) Object.assign(e.currentTarget.style, BTN_ORANGE.hover); }}
                        onMouseLeave={e => { Object.assign(e.currentTarget.style, BTN_ORANGE.leave); }}
                        disabled={loading || !reservaIdFromState}
                        >
                        {loading ? 'Procesando pago...' : (metodo === 'yape' ? '✅ Ya pagué con Yape' : metodo === 'plin' ? '✅ Ya pagué con Plin' : '💳 Confirmar pago con tarjeta')}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
