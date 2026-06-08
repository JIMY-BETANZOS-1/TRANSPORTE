import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const POPULAR_DESTINATIONS = [
  {
    city: 'Cusco',
    image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=400',
  },
  {
    city: 'Arequipa',
    image: '/images/arequipa.jpg',
  },
  {
    city: 'Trujillo',
    image: '/images/trujillo.jpg',
  },
  {
    city: 'Piura',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
  },
  {
    city: 'Chiclayo',
    image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400',
  },
  {
    city: 'Ica',
    image: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400',
  },
  {
    city: 'Puno',
    image: '/images/puno.jpg',
  },
];

function formatDateTime(value) {
  if (!value) return 'Fecha no disponible';

  const date = new Date(value);
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDuration(hours) {
  if (hours === null || hours === undefined || Number.isNaN(Number(hours))) {
    return 'Duración no disponible';
  }

  const totalMinutes = Math.round(Number(hours) * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes} min`;
  if (minutes === 0) return `${wholeHours} h`;
  return `${wholeHours} h ${minutes} min`;
}

function getLowestTariff(viaje) {
  const tarifas = viaje?.ruta?.tarifas;
  if (!Array.isArray(tarifas) || tarifas.length === 0) return null;

  return tarifas.reduce((lowest, tarifa) => {
    const precio = Number(tarifa?.precio);
    if (Number.isNaN(precio)) return lowest;
    if (lowest === null || precio < lowest) return precio;
    return lowest;
  }, null);
}

function getMinimumFareFromTarifas(tarifas) {
  if (!Array.isArray(tarifas) || tarifas.length === 0) return null;

  return tarifas.reduce((lowest, tarifa) => {
    const precio = Number(tarifa?.precio);
    if (Number.isNaN(precio)) return lowest;
    return lowest === null || precio < lowest ? precio : lowest;
  }, null);
}

function getServiceLevelColor(viaje) {
  const tarifas = viaje?.ruta?.tarifas;
  if (!Array.isArray(tarifas) || tarifas.length === 0) return '#1a237e';
  const tipos = tarifas.map((t) => String(t?.tipo || t?.clase || '').toLowerCase());
  if (tipos.some((t) => t.includes('vip'))) return '#b8860b';
  if (tipos.some((t) => t.includes('ejecutiv'))) return '#6a1b9a';
  return '#1a237e';
}

function getBusServiceIcons(bus = {}) {
  return [
    { key: 'tiene_wifi', icon: '📶', label: 'WiFi' },
    { key: 'tiene_tv', icon: '📺', label: 'TV' },
    { key: 'tiene_usb', icon: '🔌', label: 'USB' },
    { key: 'tiene_bano', icon: '🚻', label: 'Baño' },
    { key: 'tiene_aire', icon: '❄️', label: 'Aire' },
  ].filter((service) => Boolean(bus[service.key]));
}

export default function BuscarPage() {
  const navigate = useNavigate();
  const formContainerRef = useRef(null);
  const resultsRef = useRef(null);
  const destinoInputRef = useRef(null);
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fecha, setFecha] = useState('');
  const [resultados, setResultados] = useState([]);
  const [popularPrices, setPopularPrices] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [buscado, setBuscado] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPopularPrices() {
      setLoadingPopular(true);

      try {
        const { data } = await api.get('/api/rutas');

        if (!active) return;

        const rutas = Array.isArray(data) ? data : data?.data ?? [];
        const nextPrices = {};

        POPULAR_DESTINATIONS.forEach((destination) => {
          const destinationKey = destination.city.trim().toLowerCase();
          const matchingRoutes = rutas.filter((ruta) => {
            const origenRuta = String(ruta?.origen || '').trim().toLowerCase();
            const destinoRuta = String(ruta?.destino || '').trim().toLowerCase();
            return origenRuta === 'lima' && destinoRuta === destinationKey;
          });

          const minimum = matchingRoutes.reduce((acc, ruta) => {
            const fare = getMinimumFareFromTarifas(ruta?.tarifas);
            if (fare === null) return acc;
            return acc === null || fare < acc ? fare : acc;
          }, null);

          nextPrices[destination.city] = minimum;
        });

        setPopularPrices(nextPrices);
      } catch (popularError) {
        if (!active) return;
        setPopularPrices({});
      } finally {
        if (active) setLoadingPopular(false);
      }
    }

    loadPopularPrices();

    return () => {
      active = false;
    };
  }, []);

  async function performSearch(searchParams, shouldScrollResults = false) {
    setError('');
    setLoading(true);
    setBuscado(true);

    try {
      const { data } = await api.get('/api/viajes', {
        params: searchParams,
      });

      setResultados(Array.isArray(data) ? data : data?.data ?? []);
    } catch (fetchError) {
      setResultados([]);
      setError(fetchError?.response?.data?.message || 'No se pudieron cargar los viajes.');
    } finally {
      setLoading(false);

      if (shouldScrollResults) {
        window.requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }

  function handlePopularDestinationClick(city) {
    setOrigen('Lima');
    setDestino(city);
    window.setTimeout(() => destinoInputRef.current?.focus(), 250);
    performSearch({ origen: 'Lima', destino: city }, true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await performSearch({ origen, destino, fecha }, false);
  }

  return (
    <div style={{ flex: 1 }}>
      {/* ── Hero section ─────────────────────────────────────── */}
      <section
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1600)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          minHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 1rem 6rem',
        }}
      >
        {/* Overlay azul oscuro 70% */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(26,35,126,.70)',
          }}
          aria-hidden="true"
        />

        {/* Contenido del hero */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '680px' }}>
          <p
            style={{
              color: 'var(--accent-light)',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontSize: '.8rem',
              marginBottom: '.5rem',
            }}
          >
            🚌 Viajes Interprovinciales
          </p>
          <h1
            style={{
              color: 'var(--white)',
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: '1rem',
              textShadow: '0 2px 12px rgba(0,0,0,.3)',
            }}
          >
            Viaja por el Perú
          </h1>
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: '1.1rem' }}>
            Encuentra los mejores viajes seguros y confortables a todo el país
          </p>
        </div>

        {/* ── Formulario flotante ─────────────────────────────── */}
        <div
          ref={formContainerRef}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '860px',
            marginTop: '2.5rem',
          }}
        >
          <div
            className="card border-0"
            style={{
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'visible',
            }}
          >
            <div className="card-body p-4">
              {error ? (
                <div className="alert alert-danger mb-3" role="alert">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="row g-3 align-items-end">
                  <div className="col-12 col-md-4">
                    <label htmlFor="origen" className="form-label fw-semibold" style={{ color: 'var(--gray-800)' }}>
                      📍 Origen
                    </label>
                    <input
                      id="origen"
                      type="text"
                      className="form-control"
                      style={{ borderRadius: 'var(--radius-sm)', padding: '.65rem .9rem' }}
                      value={origen}
                      onChange={(event) => setOrigen(event.target.value)}
                      placeholder="Lima"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <label htmlFor="destino" className="form-label fw-semibold" style={{ color: 'var(--gray-800)' }}>
                      🏁 Destino
                    </label>
                    <input
                      id="destino"
                      ref={destinoInputRef}
                      type="text"
                      className="form-control"
                      style={{ borderRadius: 'var(--radius-sm)', padding: '.65rem .9rem' }}
                      value={destino}
                      onChange={(event) => setDestino(event.target.value)}
                      placeholder="Cusco"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-4">
                    <label htmlFor="fecha" className="form-label fw-semibold" style={{ color: 'var(--gray-800)' }}>
                      📅 Fecha de viaje
                    </label>
                    <input
                      id="fecha"
                      type="date"
                      className="form-control"
                      style={{ borderRadius: 'var(--radius-sm)', padding: '.65rem .9rem' }}
                      value={fecha}
                      onChange={(event) => setFecha(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="submit"
                    className="btn fw-semibold"
                    style={{
                      backgroundColor: '#ff6f00',
                      borderColor: '#ff6f00',
                      color: '#ffffff',
                      padding: '.7rem 2rem',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e65100'; e.currentTarget.style.borderColor = '#e65100'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ff6f00'; e.currentTarget.style.borderColor = '#ff6f00'; }}
                    disabled={loading}
                  >
                    {loading ? 'Buscando...' : '🔍 Buscar viajes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── Destinos populares ─────────────────────────────── */}
      <section className="container" style={{ marginTop: '-2.2rem', marginBottom: '2rem', position: 'relative', zIndex: 2 }}>
        <div className="d-flex justify-content-between align-items-center mb-3 px-1">
          <div>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--primary)', fontWeight: 800, margin: 0 }}>
              Destinos más viajados
            </h2>
            <div style={{ width: '48px', height: '3px', backgroundColor: 'var(--accent)', borderRadius: '2px', marginTop: '6px' }} />
          </div>
          <span style={{ fontSize: '.78rem', color: 'var(--gray-600)', fontWeight: 600 }}>
            Precio desde Lima
          </span>
        </div>

        <div className="d-flex gap-3 overflow-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          {POPULAR_DESTINATIONS.map((destination) => {
            const minimumPrice = popularPrices[destination.city];
            const priceLabel = minimumPrice != null ? `S/ ${minimumPrice.toFixed(2)}` : (loadingPopular ? 'Consultando...' : 'N/D');

            return (
              <button
                key={destination.city}
                type="button"
                className="border-0 p-0 text-start"
                style={{
                  width: '240px',
                  minWidth: '240px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-md)',
                  backgroundColor: '#0f172a',
                  cursor: 'pointer',
                }}
                onClick={() => handlePopularDestinationClick(destination.city)}
              >
                <div
                  style={{
                    height: '150px',
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.12) 0%, rgba(0,0,0,.75) 100%), url(${destination.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '.85rem',
                    transition: 'transform .2s ease',
                  }}
                >
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: 'rgba(255,255,255,.2)',
                      color: '#ffffff',
                      borderRadius: '999px',
                      fontSize: '.72rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                    }}
                  >
                    Desde {priceLabel}
                  </span>

                  <div>
                    <div style={{ color: '#ffffff', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.15 }}>
                      {destination.city}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,.82)', fontSize: '.75rem', fontWeight: 600, marginTop: '.2rem' }}>
                      Toca para buscar viajes
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Beneficios ────────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--white)', padding: '3.5rem 0' }}>
        <div className="container">
          <div className="text-center mb-4">
            <h2 style={{ fontSize: '1.6rem', color: 'var(--primary)', fontWeight: 800 }}>
              ¿Por qué viajar con nosotros?
            </h2>
            <div style={{ width: '56px', height: '3px', backgroundColor: 'var(--accent)', borderRadius: '2px', margin: '.6rem auto 0' }} />
          </div>

          <div className="row g-4">
            {[
              { icon: '🛡️', title: 'Viaje seguro', desc: 'Conductores certificados y unidades revisadas periódicamente para tu tranquilidad.' },
              { icon: '💺', title: 'Máximo confort', desc: 'Asientos reclinables, clima controlado y servicios a bordo para que llegues descansado.' },
              { icon: '🎫', title: 'Reserva fácil', desc: 'Compra tu pasaje en minutos desde cualquier dispositivo, sin complicaciones.' },
              { icon: '💳', title: 'Pago seguro', desc: 'Múltiples métodos de pago con cifrado SSL para proteger tu información.' },
            ].map((benefit, i) => (
              <div className="col-12 col-sm-6 col-lg-3" key={benefit.title}>
                <div
                  className="card border-0 h-100 text-center card-fade-in"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '2rem 1.5rem',
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <div style={{ fontSize: '2.6rem', marginBottom: '.75rem' }}>{benefit.icon}</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '.5rem' }}>
                    {benefit.title}
                  </h3>
                  <p style={{ fontSize: '.875rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>
                    {benefit.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Resultados ───────────────────────────────────────── */}
      <section ref={resultsRef} className="container py-5">
        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="text-center">
              <div
                className="spinner-border"
                role="status"
                aria-hidden="true"
                style={{ color: 'var(--accent)', width: '3rem', height: '3rem' }}
              />
              <div className="mt-3 fw-semibold" style={{ color: 'var(--gray-600)' }}>
                Buscando los mejores viajes...
              </div>
            </div>
          </div>
        ) : null}

        {!loading && resultados.length > 0 ? (
          <>
            <div className="mb-4">
              <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 700 }}>
                {resultados.length} {resultados.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}
              </h2>
            </div>

            <div className="row g-3">
              {resultados.map((viaje, index) => {
                const ruta = viaje.ruta || {};
                const bus = viaje.bus || {};
                const lowestTariff = getLowestTariff(viaje);
                const asientos = viaje.asientos_disponibles;
                const pocosAsientos = asientos !== null && asientos !== undefined && asientos <= 5;
                const busServices = getBusServiceIcons(bus);
                const levelColor = getServiceLevelColor(viaje);

                return (
                  <div className="col-12 col-md-6 col-xl-4" key={viaje.id || viaje.viaje_id}>
                    <div
                      className="card h-100 border-0 card-fade-in"
                      style={{
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)',
                        borderLeft: `4px solid ${levelColor}`,
                        transition: 'box-shadow .2s, transform .2s',
                        animationDelay: `${index * 60}ms`,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div className="card-body d-flex flex-column p-4">
                        {/* Cabecera de la card */}
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                          <div>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '.2rem' }}>
                              {ruta.origen || 'Origen'} → {ruta.destino || 'Destino'}
                            </h2>
                            <p style={{ fontSize: '.82rem', color: 'var(--gray-600)', margin: 0 }}>
                              {ruta.nombre || 'Ruta sin nombre'}
                            </p>
                          </div>

                          {/* Badge de estado */}
                          <span
                            style={{
                              backgroundColor: pocosAsientos ? '#fff3e0' : '#e8f5e9',
                              color: pocosAsientos ? '#e65100' : '#2e7d32',
                              border: `1px solid ${pocosAsientos ? '#ffcc80' : '#a5d6a7'}`,
                              borderRadius: '999px',
                              padding: '3px 10px',
                              fontSize: '.75rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {pocosAsientos ? '⚠️ Últimos asientos' : '✅ Disponible'}
                          </span>
                        </div>

                        {/* Detalles */}
                        <ul className="list-unstyled mb-4" style={{ fontSize: '.88rem' }}>
                          <li className="mb-2 d-flex gap-2">
                            <span style={{ color: 'var(--gray-600)' }}>🕐 Salida:</span>
                            <strong>{formatDateTime(viaje.fecha_salida)}</strong>
                          </li>
                          <li className="mb-2 d-flex gap-2">
                            <span style={{ color: 'var(--gray-600)' }}>⏱ Duración:</span>
                            <strong>{formatDuration(ruta.duracion_horas)}</strong>
                          </li>
                          <li className="mb-2 d-flex gap-2">
                            <span style={{ color: 'var(--gray-600)' }}>💺 Asientos:</span>
                            <strong>{asientos ?? 'No disponible'}</strong>
                          </li>
                        </ul>

                        {/* Precio + CTA */}
                        <div className="mt-auto">
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <span style={{ fontSize: '.75rem', color: 'var(--gray-600)', display: 'block' }}>
                                Precio desde
                              </span>
                              <span
                                style={{
                                  fontSize: '1.5rem',
                                  fontWeight: 800,
                                  color: 'var(--accent)',
                                  lineHeight: 1,
                                }}
                              >
                                {lowestTariff !== null ? `S/ ${lowestTariff.toFixed(2)}` : 'N/D'}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn fw-semibold"
                              style={{
                                backgroundColor: '#ff6f00',
                                borderColor: '#ff6f00',
                                color: '#ffffff',
                                borderRadius: '6px',
                                padding: '.55rem 1.25rem',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e65100'; e.currentTarget.style.borderColor = '#e65100'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ff6f00'; e.currentTarget.style.borderColor = '#ff6f00'; }}
                              onClick={() => navigate(`/asientos/${viaje.id || viaje.viaje_id}`)}
                            >
                              Seleccionar
                            </button>
                          </div>

                          <div className="d-flex flex-wrap align-items-center gap-1 mt-3">
                            {busServices.map((service) => (
                              <span
                                key={service.key}
                                className="badge text-bg-light border text-dark"
                                title={service.label}
                                style={{ fontSize: '.72rem', lineHeight: 1 }}
                              >
                                {service.icon}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {!loading && buscado && resultados.length === 0 ? (
          <div
            className="text-center py-5"
            style={{ color: 'var(--gray-600)' }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h3 style={{ fontWeight: 700, color: 'var(--primary)' }}>Sin resultados</h3>
            <p>No se encontraron viajes para tu búsqueda. Intenta con otras fechas o destinos.</p>
          </div>
        ) : null}

        {!buscado ? (
          <div className="text-center py-5" style={{ color: 'var(--gray-600)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
            <h3 style={{ fontWeight: 700, color: 'var(--primary)' }}>¿A dónde viajas hoy?</h3>
            <p>Usa el formulario de arriba para encontrar tu próximo viaje.</p>
          </div>
        ) : null}
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ backgroundColor: '#1a237e', color: 'rgba(255,255,255,.85)', marginTop: 'auto', padding: '3rem 0 1.5rem' }}>
        <div className="container">
          <div className="row g-4 mb-4">
            <div className="col-12 col-md-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span style={{ fontSize: '1.8rem' }}>🚌</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>Transportes Andinos</span>
              </div>
              <p style={{ fontSize: '.875rem', color: 'rgba(255,255,255,.60)', lineHeight: 1.7 }}>
                Tu empresa de confianza para viajes interprovinciales en el Perú. Seguridad, comodidad y puntualidad garantizadas.
              </p>
            </div>

            <div className="col-6 col-md-2">
              <h4 style={{ fontSize: '.8rem', fontWeight: 700, color: '#ffffff', marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Viajes
              </h4>
              <ul className="list-unstyled mb-0" style={{ fontSize: '.875rem', color: 'rgba(255,255,255,.60)' }}>
                <li className="mb-2">Destinos</li>
                <li className="mb-2">Horarios</li>
                <li className="mb-2">Tarifas</li>
              </ul>
            </div>

            <div className="col-6 col-md-2">
              <h4 style={{ fontSize: '.8rem', fontWeight: 700, color: '#ffffff', marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Empresa
              </h4>
              <ul className="list-unstyled mb-0" style={{ fontSize: '.875rem', color: 'rgba(255,255,255,.60)' }}>
                <li className="mb-2">Nosotros</li>
                <li className="mb-2">Seguridad</li>
                <li className="mb-2">Contacto</li>
              </ul>
            </div>

            <div className="col-12 col-md-4">
              <h4 style={{ fontSize: '.8rem', fontWeight: 700, color: '#ffffff', marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Contacto
              </h4>
              <ul className="list-unstyled mb-0" style={{ fontSize: '.875rem', color: 'rgba(255,255,255,.60)' }}>
                <li className="mb-2">📞 (01) 234-5678</li>
                <li className="mb-2">✉️ info@transportesandinos.pe</li>
                <li className="mb-2">📍 Av. Javier Prado 1234, Lima</li>
              </ul>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: '1.25rem', textAlign: 'center', fontSize: '.78rem', color: 'rgba(255,255,255,.35)' }}>
            © {new Date().getFullYear()} Transportes Andinos · Todos los derechos reservados
          </div>
        </div>
      </footer>
    </div>
  );
}
