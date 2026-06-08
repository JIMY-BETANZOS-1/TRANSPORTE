# Transportes Andinos

## Colección Postman de buses

En la raíz del proyecto está el archivo `buses.postman_collection.json` con todos los endpoints de buses listos para probar.

## Cómo obtener el token

1. Asegúrate de que el backend esté corriendo.
2. Haz una petición `POST` a `/api/auth/login`.
3. Envía un body JSON con tus credenciales. Ejemplo:

```json
{
  "email": "admin@transportes.com",
  "password": "password"
}
```

4. La respuesta debe incluir un token JWT.
5. Copia el token y pégalo en la variable `token` de la colección Postman.

## Variables de la colección

- `baseUrl`: por defecto `http://localhost:3001`
- `token`: JWT obtenido desde `/api/auth/login`
- `id`: id del bus que quieras consultar, editar o desactivar

## Uso rápido

1. Importa `buses.postman_collection.json` en Postman.
2. Abre la colección y define `baseUrl`, `token` e `id`.
3. Ejecuta las peticiones de buses.

## Headers de autorización

Las peticiones de buses usan el header:

```http
Authorization: Bearer {{token}}
```

Esto aplica especialmente a las rutas protegidas como crear, editar, cambiar estado y desactivar.
