ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT FALSE;

UPDATE usuarios
SET es_principal = FALSE
WHERE rol = 'admin';

WITH primer_admin AS (
  SELECT id
  FROM usuarios
  WHERE rol = 'admin'
  ORDER BY id ASC
  LIMIT 1
)
UPDATE usuarios
SET es_principal = TRUE
FROM primer_admin
WHERE usuarios.id = primer_admin.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_admin_principal
  ON usuarios (es_principal)
  WHERE rol = 'admin' AND es_principal IS TRUE;