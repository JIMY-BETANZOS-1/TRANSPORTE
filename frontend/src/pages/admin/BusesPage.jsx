import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import api from '../../services/api';

const estadoOptions = [
  { value: 'operativo', label: 'Operativo' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'fuera_de_servicio', label: 'Fuera de servicio' },
  { value: 'desactivado', label: 'Desactivado' },
];

const servicioOptions = [
  { key: 'tiene_wifi', label: 'WiFi', icon: '📶' },
  { key: 'tiene_tv', label: 'TV', icon: '📺' },
  { key: 'tiene_usb', label: 'USB', icon: '🔌' },
  { key: 'tiene_bano', label: 'Baño', icon: '🚻' },
  { key: 'tiene_aire', label: 'Aire', icon: '❄️' },
];

const tipoAsientoOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'semi-reclinable', label: 'Semi-reclinable' },
  { value: 'reclinable-180', label: 'Reclinable 180°' },
];

const nivelServicioOptions = [
  { value: 'economico', label: 'Económico' },
  { value: 'ejecutivo', label: 'Ejecutivo' },
  { value: 'vip', label: 'VIP' },
];

function emptyForm() {
  return {
    id: null,
    placa: '',
    modelo: '',
    anio: '',
    num_pisos: '1',
    capacidad_total: '',
    tiene_wifi: false,
    tiene_tv: false,
    tiene_usb: false,
    tiene_bano: false,
    tiene_aire: false,
    tipo_asiento: 'semi-reclinable',
    nivel_servicio: 'economico',
    estado: 'operativo',
  };
}

function normalizeBus(bus) {
  return {
    ...bus,
    anio: bus.anio ?? '',
    num_pisos: bus.num_pisos ?? '',
    capacidad_total: bus.capacidad_total ?? '',
    tiene_wifi: Boolean(bus.tiene_wifi),
    tiene_tv: Boolean(bus.tiene_tv),
    tiene_usb: Boolean(bus.tiene_usb),
    tiene_bano: Boolean(bus.tiene_bano),
    tiene_aire: Boolean(bus.tiene_aire),
    tipo_asiento: bus.tipo_asiento ?? 'semi-reclinable',
    nivel_servicio: bus.nivel_servicio ?? 'economico',
    servicios: Array.isArray(bus.servicios) ? bus.servicios : [],
  };
}

export default function BusesPage() {
  const { rol } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [buses, setBuses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [rowStates, setRowStates] = useState({});

  useEffect(() => {
    let active = true;

    async function loadBuses() {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get('/api/buses');
        if (!active) return;
        setBuses(Array.isArray(data) ? data.map(normalizeBus) : []);
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError?.response?.data?.message || 'No se pudieron cargar los buses.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBuses();

    return () => {
      active = false;
    };
  }, []);

  const busesOrdenados = useMemo(
    () => [...buses].sort((a, b) => Number(a.id) - Number(b.id)),
    [buses]
  );

  if (rol !== 'admin') {
    return <Navigate to="/buscar" replace />;
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function openCreateModal() {
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEditModal(bus) {
    setForm({
      ...emptyForm(),
      ...normalizeBus(bus),
      id: bus.id,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setForm(emptyForm());
  }

  function buildBusPayload() {
    return {
      placa: form.placa.trim(),
      modelo: form.modelo.trim(),
      anio: form.anio ? Number(form.anio) : null,
      num_pisos: form.num_pisos ? Number(form.num_pisos) : null,
      capacidad_total: form.capacidad_total ? Number(form.capacidad_total) : null,
      tiene_wifi: Boolean(form.tiene_wifi),
      tiene_tv: Boolean(form.tiene_tv),
      tiene_usb: Boolean(form.tiene_usb),
      tiene_bano: Boolean(form.tiene_bano),
      tiene_aire: Boolean(form.tiene_aire),
      tipo_asiento: form.tipo_asiento,
      nivel_servicio: form.nivel_servicio,
      estado: form.estado,
    };
  }

  async function handleSubmitBus(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = buildBusPayload();
      const isEditing = form.id !== null;
      const request = isEditing
        ? api.put(`/api/buses/${form.id}`, payload)
        : api.post('/api/buses', payload);
      const { data } = await request;

      setBuses((current) => {
        if (isEditing) {
          return current.map((bus) => (Number(bus.id) === Number(form.id) ? normalizeBus(data) : bus));
        }
        return [...current, normalizeBus(data)];
      });

      setForm(emptyForm());
      setShowModal(false);
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'No se pudo guardar el bus.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeState(busId) {
    const nextState = rowStates[busId];
    if (!nextState) return;

    setError('');

    try {
      const { data } = await api.patch(`/api/buses/${busId}/estado`, { estado: nextState });
      setBuses((current) => current.map((bus) => (Number(bus.id) === Number(busId) ? normalizeBus(data) : bus)));
    } catch (patchError) {
      setError(patchError?.response?.data?.message || 'No se pudo cambiar el estado del bus.');
    }
  }

  return (
    <div className="container py-4 py-md-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Gestión de buses</h1>
          <p className="text-muted mb-0">Listado, creación y cambio de estado de la flota.</p>
        </div>

        <Link to="/admin/dashboard" className="btn btn-outline-secondary">
          Volver al dashboard
        </Link>
      </div>

      <div className="d-flex justify-content-end mb-3">
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          Nuevo bus
        </button>
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
                <div className="mt-3 text-muted">Cargando buses...</div>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Placa</th>
                    <th>Modelo</th>
                    <th>Año</th>
                    <th>Pisos</th>
                    <th>Capacidad</th>
                    <th>Servicios</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {busesOrdenados.map((bus) => (
                    <tr key={bus.id}>
                      <td className="fw-semibold">{bus.placa}</td>
                      <td>{bus.modelo || '-'}</td>
                      <td>{bus.anio || '-'}</td>
                      <td>{bus.num_pisos || '-'}</td>
                      <td>{bus.capacidad_total || '-'}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {servicioOptions
                            .filter((servicio) => bus[servicio.key])
                            .map((servicio) => (
                              <span
                                key={servicio.key}
                                className="badge text-bg-light border text-dark"
                                title={servicio.label}
                                aria-label={servicio.label}
                              >
                                {servicio.icon}
                              </span>
                            ))}
                          {!servicioOptions.some((servicio) => bus[servicio.key]) ? (
                            <span className="text-muted">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${bus.estado === 'operativo' ? 'text-bg-success' : bus.estado === 'mantenimiento' ? 'text-bg-warning' : 'text-bg-secondary'}`}>
                          {bus.estado}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2">
                          <select
                            className="form-select form-select-sm"
                            style={{ width: '180px' }}
                            value={rowStates[bus.id] ?? bus.estado}
                            onChange={(event) => setRowStates((current) => ({ ...current, [bus.id]: event.target.value }))}
                          >
                            {estadoOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleChangeState(bus.id)}>
                            Cambiar estado
                          </button>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openEditModal(bus)}>
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!busesOrdenados.length ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        No hay buses registrados.
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
          <div className="card shadow-lg w-100" style={{ maxWidth: '720px' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h2 className="h5 mb-0">Nuevo bus</h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setShowModal(false)} />
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmitBus}>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label htmlFor="placa" className="form-label">Placa</label>
                    <input id="placa" name="placa" type="text" className="form-control" value={form.placa} onChange={handleFormChange} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="modelo" className="form-label">Modelo</label>
                    <input id="modelo" name="modelo" type="text" className="form-control" value={form.modelo} onChange={handleFormChange} required />
                  </div>
                  <div className="col-12 col-md-4">
                    <label htmlFor="anio" className="form-label">Año</label>
                    <input id="anio" name="anio" type="number" className="form-control" value={form.anio} onChange={handleFormChange} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label htmlFor="num_pisos" className="form-label">Pisos</label>
                    <select id="num_pisos" name="num_pisos" className="form-select" value={form.num_pisos} onChange={handleFormChange}>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label htmlFor="capacidad_total" className="form-label">Capacidad</label>
                    <input id="capacidad_total" name="capacidad_total" type="number" className="form-control" value={form.capacidad_total} onChange={handleFormChange} />
                  </div>
                  <div className="col-12">
                    <label htmlFor="estado" className="form-label">Estado</label>
                    <select id="estado" name="estado" className="form-select" value={form.estado} onChange={handleFormChange}>
                      {estadoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Servicios disponibles</label>
                    <div className="row g-2">
                      {servicioOptions.map((servicio) => (
                        <div key={servicio.key} className="col-12 col-sm-6 col-md-4">
                          <div className="form-check border rounded p-2 h-100">
                            <input
                              id={servicio.key}
                              name={servicio.key}
                              type="checkbox"
                              className="form-check-input"
                              checked={Boolean(form[servicio.key])}
                              onChange={handleFormChange}
                            />
                            <label htmlFor={servicio.key} className="form-check-label ms-2">
                              {servicio.icon} {servicio.label}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label htmlFor="tipo_asiento" className="form-label">Tipo de asiento</label>
                    <select id="tipo_asiento" name="tipo_asiento" className="form-select" value={form.tipo_asiento} onChange={handleFormChange}>
                      {tipoAsientoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label htmlFor="nivel_servicio" className="form-label">Nivel de servicio</label>
                    <select id="nivel_servicio" name="nivel_servicio" className="form-select" value={form.nivel_servicio} onChange={handleFormChange}>
                      {nivelServicioOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear bus'}
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