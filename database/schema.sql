-- Usuarios administradores
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  rol VARCHAR(20) DEFAULT 'operador' CHECK (rol IN ('admin','operador')),
  es_principal BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Buses
CREATE TABLE buses (
  id SERIAL PRIMARY KEY,
  placa VARCHAR(20) UNIQUE NOT NULL,
  modelo VARCHAR(100),
  anio INT,
  num_pisos INT DEFAULT 1 CHECK (num_pisos IN (1, 2)),
  capacidad_total INT,
  servicios TEXT[],
  estado VARCHAR(20) DEFAULT 'operativo'
    CHECK (estado IN ('operativo','mantenimiento','fuera_de_servicio')),
  fotos TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Configuración de asientos por bus
CREATE TABLE configuracion_asientos (
  id SERIAL PRIMARY KEY,
  bus_id INT REFERENCES buses(id) ON DELETE CASCADE,
  piso INT NOT NULL,
  fila INT NOT NULL,
  columna INT NOT NULL,
  codigo VARCHAR(10),
  tipo VARCHAR(20) DEFAULT 'normal' CHECK (tipo IN ('normal','vip'))
);

-- Rutas
CREATE TABLE rutas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  origen VARCHAR(100) NOT NULL,
  destino VARCHAR(100) NOT NULL,
  distancia_km DECIMAL(8,2),
  duracion_horas DECIMAL(4,1)
);

-- Tarifas por ruta y tipo de asiento
CREATE TABLE tarifas (
  id SERIAL PRIMARY KEY,
  ruta_id INT REFERENCES rutas(id),
  tipo_asiento VARCHAR(20) DEFAULT 'normal',
  precio DECIMAL(10,2) NOT NULL
);

-- Viajes
CREATE TABLE viajes (
  id SERIAL PRIMARY KEY,
  ruta_id INT REFERENCES rutas(id),
  bus_id INT REFERENCES buses(id),
  fecha_salida TIMESTAMP NOT NULL,
  fecha_llegada TIMESTAMP,
  estado VARCHAR(20) DEFAULT 'borrador'
    CHECK (estado IN ('borrador','en_venta','cancelado','completado')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pasajeros
CREATE TABLE pasajeros (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  dni VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  telefono VARCHAR(20)
);

-- Reservas
CREATE TABLE reservas (
  id SERIAL PRIMARY KEY,
  viaje_id INT REFERENCES viajes(id),
  asiento_id INT REFERENCES configuracion_asientos(id),
  pasajero_id INT REFERENCES pasajeros(id),
  estado VARCHAR(20) DEFAULT 'reservado'
    CHECK (estado IN ('reservado','pagado','liberado','cancelado')),
  expira_en TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pagos
CREATE TABLE pagos (
  id SERIAL PRIMARY KEY,
  reserva_id INT REFERENCES reservas(id),
  metodo VARCHAR(20) CHECK (metodo IN ('culqi','yape','plin')),
  monto DECIMAL(10,2),
  estado VARCHAR(20) DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','pagado','rechazado','anulado','reverso')),
  referencia_externa VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auditoría
CREATE TABLE auditoria (
  id SERIAL PRIMARY KEY,
  tabla VARCHAR(50),
  accion VARCHAR(20),
  usuario_id INT,
  datos JSONB,
  ip VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_viajes_ruta_fecha ON viajes(ruta_id, fecha_salida);
CREATE INDEX idx_reservas_estado ON reservas(estado);
CREATE INDEX idx_reservas_expira ON reservas(expira_en) WHERE estado = 'reservado';
CREATE INDEX idx_pagos_estado ON pagos(estado);
CREATE UNIQUE INDEX idx_usuarios_admin_principal ON usuarios (es_principal)
  WHERE rol = 'admin' AND es_principal IS TRUE;