# AgendaME · Sistema de Reservas (Stack MEAN)

Aplicación web multiempresa de gestión de reservas construida con **MongoDB, Express, Angular y Node.js**.

## Estructura

- `backend/`: API REST con Node.js, Express y Mongoose.
- `frontend/`: aplicación SPA con Angular y Nginx.
- `docker-compose.yml`: orquestación de MongoDB 7.0 (Replica Set), backend y frontend.

## Requisitos

- **Docker Engine** 24 o superior y **Docker Compose** v2.
- *(Opcional, solo para ejecución manual sin Docker completo)* Node.js 20+ y npm 10+.

## Puesta en marcha con Docker (recomendado)

Desde la carpeta raíz del proyecto:

```bash
docker compose up --build -d
```

Cargar datos iniciales de demostración (negocio de ejemplo, servicios y cuentas):

```bash
docker compose exec backend npm run seed
```

### Accesos

- **Aplicación web:** <http://localhost:8080>
- **Estado de la API:** <http://localhost:8080/api/health>

### Cuentas de demostración

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| Superadmin | `superadmin@demo.cl` | `Password123` |
| Administrador de negocio | `admin@demo.cl` | `Password123` |
| Cliente | `cliente@demo.cl` | `Password123` |

### Detener los servicios

```bash
# Detener contenedores conservando los datos
docker compose down

# Detener contenedores y eliminar volúmenes locales (base de datos e imágenes)
docker compose down -v
```

Si el puerto `8080` está ocupado, puedes indicar otro al iniciar:

```bash
FRONTEND_PORT=8081 docker compose up --build -d
```

## Ejecución manual (desarrollo local)

1. Levantar únicamente MongoDB en Docker:

```bash
docker compose up -d mongo
```

2. Instalar dependencias e iniciar el backend:

```bash
cd backend
npm install
npm run seed
npm run dev
```

3. En otra terminal, instalar dependencias e iniciar el frontend:

```bash
cd frontend
npm install
npm start
```

El frontend quedará disponible en <http://localhost:4200> y el backend en <http://localhost:3000>.

## Pruebas y verificación

```bash
# Pruebas del backend dentro de Docker
docker compose exec backend npm test

# Linter y verificación de formato en backend
docker compose exec backend npm run lint
docker compose exec backend npm run format:check
```

Para ejecutar las pruebas del frontend localmente:

```bash
cd frontend
npm test
```
