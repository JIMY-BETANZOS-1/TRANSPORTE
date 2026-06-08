import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import api from '../../services/api';

function emptyForm() {
  return {
    ruta_id: '',
    bus_id: '',
    fecha_salida: '',
    fecha_llegada: '',
    horas_antes_venta: 24,
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

function getRutaLabel(viaje) {
  const ruta = viaje?.ruta || {};
  if (ruta.origen && ruta.destino) return `${ruta.origen} → ${ruta.destino}`;
  return ruta.nombre || '-';
}

function getBusLabel(viaje) {
  const bus = viaje?.bus || {};
  if (bus.placa && bus.modelo) return `${bus.placa} - ${bus.modelo}`;
  return bus.placa || bus.modelo || '-';
}

export default function ViajesPage() {
  const { rol } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [viajes, setViajes] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [buses, setBuses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [rowLoading, setRowLoading] = useState({});

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const [viajesRes, rutasRes, busesRes] = await Promise.all([
          api.get('/api/viajes'),
          api.get('/api/rutas'),
          api.get('/api/buses'),
        ]);

        if (!active) return;

        setViajes(Array.isArray(viajesRes.data) ? viajesRes.data : []);
        setRutas(Array.isArray(rutasRes.data) ? rutasRes.data : []);
        setBuses(Array.isArray(busesRes.data) ? busesRes.data : []);
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError?.response?.data?.message || 'No se pudieron cargar los viajes.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const viajesOrdenados = useMemo(
    () => [...viajes].sort((a, b) => Number(a.id) - Number(b.id)),
    [viajes]
  );

  if (rol !== 'admin') {
    return <Navigate to="/buscar" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ruta_id: Number(form.ruta_id),
        bus_id: Number(form.bus_id),
        fecha_salida: form.fecha_salida,
        fecha_llegada: form.fecha_llegada || null,
        horas_antes_venta: Number(form.horas_antes_venta) || 24,
      };

      const { data } = await api.post('/api/viajes', payload);
      setViajes((current) => [...current, data]);
      setForm(emptyForm());
      setShowModal(false);
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'No se pudo crear el viaje.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeEstado(viajeId, estado) {
    setRowLoading((current) => ({ ...current, [viajeId]: estado }));
    setError('');

    try {
      const { data } = await api.patch(`/api/viajes/${viajeId}/estado`, { estado });
      setViajes((current) => current.map((viaje) => (Number(viaje.id) === Number(viajeId) ? data : viaje)));
    } catch (patchError) {
      setError(patchError?.response?.data?.message || 'No se pudo actualizar el estado del viaje.');
    } finally {
      setRowLoading((current) => {
        const next = { ...current };
        delete next[viajeId];
        return next;
      });
    }
  }

  return (
    <div className="container py-4 py-md-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Gestión de viajes</h1>
          <p className="text-muted mb-0">Listado, publicación y cancelación de viajes.</p>
        </div>

        <div className="d-flex gap-2">
          <Link to="/admin/dashboard" className="btn btn-outline-secondary">
            Volver al dashboard
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
            Nuevo viaje
          </button>
        </div>
      </div>

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
                <div className="mt-3 text-muted">Cargando viajes...</div>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Ruta</th>
                    <th>Bus</th>
                    <th>Fecha salida</th>
                    <th>Fecha llegada</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {viajesOrdenados.map((viaje) => {
                    const isBusy = Boolean(rowLoading[viaje.id]);

                    return (
                      <tr key={viaje.id}>
                        <td>{getRutaLabel(viaje)}</td>
                        <td>{getBusLabel(viaje)}</td>
                        <td>{formatDateTime(viaje.fecha_salida)}</td>
                        <td>{formatDateTime(viaje.fecha_llegada)}</td>
                        <td>
                          <span className={`badge ${viaje.estado === 'en_venta' ? 'text-bg-success' : viaje.estado === 'cancelado' ? 'text-bg-danger' : viaje.estado === 'completado' ? 'text-bg-secondary' : 'text-bg-warning'}`}>
                            {viaje.estado}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm"
                              disabled={isBusy || viaje.estado === 'en_venta'}
                              onClick={() => handleChangeEstado(viaje.id, 'en_venta')}
                            >
                              {isBusy && rowLoading[viaje.id] === 'en_venta' ? 'Procesando...' : 'Publicar'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={isBusy || viaje.estado === 'cancelado'}
                              onClick={() => handleChangeEstado(viaje.id, 'cancelado')}
                            >
                              {isBusy && rowLoading[viaje.id] === 'cancelado' ? 'Procesando...' : 'Cancelar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!viajesOrdenados.length ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No hay viajes registrados.
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
              <h2 className="h5 mb-0">Nuevo viaje</h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setShowModal(false)} />
            </div>
            <div className="card-body">
              <form onSubmit={handleCreate}>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label htmlFor="ruta_id" className="form-label">Ruta</label>
                    <select id="ruta_id" name="ruta_id" className="form-select" value={form.ruta_id} onChange={handleChange} required>
                      <option value="">Selecciona una ruta</option>
                      {rutas.map((ruta) => (
                        <option key={ruta.id} value={ruta.id}>
                          {ruta.origen} → {ruta.destino}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="bus_id" className="form-label">Bus</label>
                    <select id="bus_id" name="bus_id" className="form-select" value={form.bus_id} onChange={handleChange} required>
                      <option value="">Selecciona un bus</option>
                      {buses.map((bus) => (
                        <option key={bus.id} value={bus.id}>
                          {bus.placa} - {bus.modelo || 'Sin modelo'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="fecha_salida" className="form-label">Fecha salida</label>
                    <input id="fecha_salida" name="fecha_salida" type="datetime-local" className="form-control" value={form.fecha_salida} onChange={handleChange} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="fecha_llegada" className="form-label">Fecha llegada</label>
                    <input id="fecha_llegada" name="fecha_llegada" type="datetime-local" className="form-control" value={form.fecha_llegada} onChange={handleChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="horas_antes_venta" className="form-label">
                      Publicar automáticamente (horas antes de la salida)
                    </label>
                    <input
                      id="horas_antes_venta"
                      name="horas_antes_venta"
                      type="number"
                      className="form-control"
                      value={form.horas_antes_venta}
                      onChange={handleChange}
                      min="1"
                      max="72"
                      required
                    />
                    <div className="form-text">El viaje se publicará automáticamente esta cantidad de horas antes de la salida.</div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Crear viaje'}
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