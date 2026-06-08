import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/buscar', { replace: true });
    } catch (loginError) {
      setError(loginError?.response?.data?.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        backgroundImage: 'url(https://images.unsplash.com/photo-1580619305218-8423a7ef79b4?w=1200)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      {/* Overlay azul oscuro */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(26,35,126,.78)',
        }}
        aria-hidden="true"
      />

      {/* Card de login */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          zIndex: 1,
        }}
      >
        <div
          className="card border-0"
          style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 16px 60px rgba(0,0,0,.45)' }}
        >
          <div className="card-body p-4 p-md-5">
            {/* Logo */}
            <div className="text-center mb-4">
              <div style={{ fontSize: '3rem', lineHeight: 1 }}>🚌</div>
              <h1
                className="mt-2 mb-1"
                style={{ fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 800 }}
              >
                Transportes Andinos
              </h1>
              <p className="text-muted" style={{ fontSize: '.9rem' }}>
                Inicia sesión para continuar
              </p>
            </div>

            {/* Línea decorativa */}
            <div
              style={{
                height: '3px',
                background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                borderRadius: '2px',
                marginBottom: '1.75rem',
              }}
            />

            {error ? (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="email" className="form-label fw-semibold">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  style={{ borderRadius: 'var(--radius-sm)', padding: '.65rem .9rem' }}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@correo.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="password" className="form-label fw-semibold">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  style={{ borderRadius: 'var(--radius-sm)', padding: '.65rem .9rem' }}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100"
                style={{ padding: '.7rem', fontSize: '1rem', borderRadius: 'var(--radius-sm)' }}
                disabled={loading}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
