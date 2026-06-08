import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Navbar() {
  const { token, rol, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav
      style={{
        backgroundColor: '#1a237e',
        boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,.40)' : '0 2px 12px rgba(0,0,0,.25)',
        position: 'sticky',
        top: 0,
        zIndex: 1030,
        transition: 'box-shadow .3s ease',
      }}
      className="navbar navbar-expand-lg navbar-dark"
    >
      <div className="container">
        <Link
          className="navbar-brand d-flex align-items-center gap-2 fw-bold"
          to="/buscar"
          style={{ fontSize: '1.2rem', letterSpacing: '-.2px', color: '#ffffff' }}
        >
          <span style={{ fontSize: '1.5rem' }}>🚌</span>
          Transportes Andinos
        </Link>

        <div className="navbar-nav ms-auto flex-row align-items-center gap-1">
          {rol === 'admin' ? (
            <Link
              className="nav-link px-3 py-2 rounded"
              to="/admin/dashboard"
              style={{ color: 'rgba(255,255,255,.85)', fontWeight: 500, transition: 'color .2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff6f00'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.85)'; }}
            >
              Dashboard
            </Link>
          ) : null}

          {!token ? (
            <Link
              className="nav-link px-3 py-2 rounded"
              to="/login"
              style={{ color: 'rgba(255,255,255,.85)', fontWeight: 500, transition: 'color .2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff6f00'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.85)'; }}
            >
              Iniciar sesión
            </Link>
          ) : null}

          {token ? (
            <button
              type="button"
              className="btn btn-sm ms-2 fw-semibold"
              onClick={handleLogout}
              style={{
                backgroundColor: '#ff6f00',
                borderColor: '#ff6f00',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '6px 16px',
                transition: 'background-color .2s, box-shadow .2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#e65100';
                e.currentTarget.style.borderColor = '#e65100';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(255,111,0,.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#ff6f00';
                e.currentTarget.style.borderColor = '#ff6f00';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
