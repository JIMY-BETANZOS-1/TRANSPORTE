import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import api from '../../services/api';

function emptyForm() {
  return {
    nombre: '',
    email: '',
    password: '',
    es_principal: false,
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function AdminsPage() {
  const { rol, esPrincipal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [admins, setAdmins] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [rowLoading, setRowLoading] = useState({});

  useEffect(() => {
    let active = true;

    async function loadAdmins() {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get('/api/admin/admins');
        if (!active) return;
        setAdmins(Array.isArray(data) ? data : []);
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError?.response?.data?.message || 'No se pudieron cargar los administradores.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAdmins();

    return () => {
      active = false;
    };
  }, []);

  const adminsOrdenados = useMemo(
    () => [...admins].sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || Number(a.id) - Number(b.id)),
    [admins]
  );

  if (rol !== 'admin') {
    return <Navigate to="/buscar" replace />;
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleCreateAdmin(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        es_principal: form.es_principal,
      };

      const { data } = await api.post('/api/admin/admins', payload);
      setAdmins((current) => [data, ...current.map((admin) => ({ ...admin, es_principal: data.es_principal ? false : admin.es_principal }))]);
      setForm(emptyForm());
      setShowModal(false);
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'No se pudo crear el administrador.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPrincipal(adminId) {
    if (!esPrincipal) return;

    setRowLoading((current) => ({ ...current, [adminId]: true }));
    setError('');

    try {
      const { data } = await api.patch(`/api/admin/admins/${adminId}/principal`);
      setAdmins((current) => current.map((admin) => ({ ...admin, es_principal: Number(admin.id) === Number(data.id) })));
    } catch (patchError) {
      setError(patchError?.response?.data?.message || 'No se pudo cambiar el admin principal.');
    } finally {
      setRowLoading((current) => {
        const next = { ...current };
        delete next[adminId];
        return next;
      });
    }
  }

  return (
    <div className="container py-4 py-md-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Administradores</h1>
          <p className="text-muted mb-0">Listado, creación y selección del admin principal.</p>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <Link to="/admin/dashboard" className="btn btn-outline-secondary">
            Volver al dashboard
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)} disabled={false}>
            Nuevo admin
          </button>
        </div>
      </div>

      {!esPrincipal ? (
        <div className="alert alert-warning" role="alert">
          Solo el admin principal puede crear otros administradores y cambiar el principal.
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          {loading ? (
            <div className="d-flex justify-content-center align-items-center py-5">
              <div className="text-center">
                <div className="spinner-border text-primary" role="status" aria-hidden="true" />
                <div className="mt-3 text-muted">Cargando administradores...</div>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Activo</th>
                    <th>Principal</th>
                    <th>Creado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {adminsOrdenados.map((admin) => {
                    const isBusy = Boolean(rowLoading[admin.id]);

                    return (
                      <tr key={admin.id}>
                        <td className="fw-semibold">{admin.nombre}</td>
                        <td>{admin.email}</td>
                        <td>
                          <span className={`badge ${admin.activo ? 'text-bg-success' : 'text-bg-secondary'}`}>
                            {admin.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          {admin.es_principal ? (
                            <span className="badge text-bg-primary">Principal</span>
                          ) : (
                            <span className="text-muted">No</span>
                          )}
                        </td>
                        <td>{formatDateTime(admin.created_at)}</td>
                        <td>
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              disabled={false}
                              onClick={() => handleSetPrincipal(admin.id)}
                            >
                              {isBusy ? 'Procesando...' : 'Hacer principal'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!adminsOrdenados.length ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No hay administradores registrados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal ? (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 1050 }}>
          <div className="card shadow-lg w-100" style={{ maxWidth: '760px' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h2 className="h5 mb-0">Nuevo administrador</h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setShowModal(false)} />
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateAdmin}>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label htmlFor="nombre" className="form-label">Nombre</label>
                    <input id="nombre" name="nombre" type="text" className="form-control" value={form.nombre} onChange={handleChange} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="email" className="form-label">Email</label>
                    <input id="email" name="email" type="email" className="form-control" value={form.email} onChange={handleChange} required />
                  </div>
                  <div className="col-12">
                    <label htmlFor="password" className="form-label">Password</label>
                    <input id="password" name="password" type="password" className="form-control" value={form.password} onChange={handleChange} required />
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input id="es_principal" name="es_principal" type="checkbox" className="form-check-input" checked={form.es_principal} onChange={handleChange} />
                      <label htmlFor="es_principal" className="form-check-label">Hacerlo admin principal</label>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={false}>
                    {saving ? 'Guardando...' : 'Crear admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}