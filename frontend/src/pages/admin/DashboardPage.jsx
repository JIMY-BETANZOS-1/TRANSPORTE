import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import api from '../../services/api';

const KPI_CARDS = [
  { key: 'total_viajes',    icon: '🚌', label: 'Total viajes',         prefix: '',    currency: false },
  { key: 'reservas_hoy',   icon: '🎟️', label: 'Reservas hoy',          prefix: '',    currency: false },
  { key: 'ingresos_mes',   icon: '💰', label: 'Ingresos del mes',       prefix: 'S/ ', currency: true  },
  { key: 'buses_operativos', icon: '🛞', label: 'Buses operativos',    prefix: '',    currency: false },
];

function formatValue(value, currency) {
  if (currency) {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
  }
  return value.toLocaleString('es-PE');
}

export default function DashboardPage() {
  const { rol } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metricas, setMetricas] = useState({
    total_viajes: 0,
    reservas_hoy: 0,
    ingresos_mes: 0,
    buses_operativos: 0,
  });

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get('/api/admin/metricas');

        if (!active) return;

        setMetricas({
          total_viajes: Number(data?.total_viajes || 0),
          reservas_hoy: Number(data?.reservas_hoy || 0),
          ingresos_mes: Number(data?.ingresos_mes || 0),
          buses_operativos: Number(data?.buses_operativos || 0),
        });
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError?.response?.data?.message || 'No se pudo cargar el dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (rol !== 'admin') {
    return <Navigate to="/buscar" replace />;
  }

  const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ flex: 1, backgroundColor: 'var(--gray-50)' }}>
      {/* ── Header azul oscuro ───────────────────────────────── */}
      <header
        style={{
          background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 60%, var(--primary-light) 100%)',
          padding: '2.5rem 0 3rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Círculos decorativos */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,.05)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '10%',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,111,0,.1)',
            pointerEvents: 'none',
          }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <p
                style={{
                  color: 'var(--accent-light)',
                  fontSize: '.8rem',
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  marginBottom: '.4rem',
                }}
              >
                Panel de Administración
              </p>
              <h1 style={{ color: 'var(--white)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, marginBottom: '.4rem' }}>
                Bienvenido, Administrador 👋
              </h1>
              <p style={{ color: 'rgba(255,255,255,.65)', fontSize: '.9rem', textTransform: 'capitalize' }}>
                {today}
              </p>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <Link
                to="/admin/viajes"
                className="btn btn-sm fw-semibold"
                style={{
                  backgroundColor: 'var(--accent)',
                  borderColor: 'var(--accent)',
                  color: 'var(--white)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 18px',
                }}
              >
                🚌 Gestionar viajes
              </Link>
              <Link
                to="/admin/buses"
                className="btn btn-sm fw-semibold"
                style={{
                  backgroundColor: 'rgba(255,255,255,.12)',
                  borderColor: 'rgba(255,255,255,.3)',
                  color: 'var(--white)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 18px',
                }}
              >
                🛞 Gestionar buses
              </Link>
              <Link
                to="/admin/admins"
                className="btn btn-sm fw-semibold"
                style={{
                  backgroundColor: 'rgba(255,255,255,.12)',
                  borderColor: 'rgba(255,255,255,.3)',
                  color: 'var(--white)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 18px',
                }}
              >
                👤 Gestionar admins
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Contenido principal ──────────────────────────────── */}
      <main className="container py-4 py-md-5">
        {error ? (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        ) : null}

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
                Cargando indicadores...
              </div>
            </div>
          </div>
        ) : (
          <div className="row g-3 g-md-4">
            {KPI_CARDS.map(({ key, icon, label, currency }) => (
              <div className="col-12 col-sm-6 col-xl-3" key={key}>
                <div
                  className="card border-0 h-100"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    borderTop: '4px solid var(--accent)',
                    transition: 'box-shadow .2s, transform .2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <span style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</span>
                      <span
                        style={{
                          backgroundColor: 'rgba(26,35,126,.08)',
                          color: 'var(--primary)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 10px',
                          fontSize: '.72rem',
                          fontWeight: 700,
                          letterSpacing: '.5px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Hoy
                      </span>
                    </div>
                    <p style={{ fontSize: '.85rem', color: 'var(--gray-600)', marginBottom: '.4rem', fontWeight: 500 }}>
                      {label}
                    </p>
                    <div
                      style={{
                        fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                        fontWeight: 800,
                        color: 'var(--primary)',
                        lineHeight: 1.1,
                      }}
                    >
                      {formatValue(metricas[key], currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
