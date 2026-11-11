# Sistema de reservas MEAN

Aplicación web de reservas construida con MongoDB, Express, Angular y Node.js.

## Estructura

- `backend/`: API REST con Node.js y Express.
- `frontend/`: aplicación SPA con Angular.

## Requisitos

### Opción recomendada: Docker

- Docker Engine 24 o superior.
- Docker Compose v2.

### Opción manual

- Node.js 20 o superior.
- npm 10 o superior.
- Una base de datos MongoDB local o un cluster de MongoDB Atlas.

## Puesta en marcha con Docker

Docker ejecuta el frontend, el backend y MongoDB en servicios separados. Los
datos de MongoDB se conservan en el volumen `mongo-data`.

Desde la carpeta raíz del proyecto:

```bash
docker compose up --build
```

La aplicación estará disponible en <http://localhost:8080> y la API de salud en
<http://localhost:8080/api/health>. Para detener los servicios:

```bash
docker compose down
```

Para detenerlos y eliminar también los datos locales de MongoDB:

```bash
docker compose down -v
```

El secreto JWT incluido por defecto es solo para desarrollo. Antes de
compartir o desplegar el proyecto, define uno propio:

```bash
JWT_SECRET='un-secreto-largo-y-privado' docker compose up --build
```

Si el puerto `8080` está ocupado, puedes cambiarlo:

```bash
FRONTEND_PORT=8081 docker compose up --build
```

`backend/.env` viene preconfigurado con `mongodb://localhost:27017/reservas` para desarrollo local en máquina host. Dentro de Docker Compose, el backend se enlaza automáticamente a `mongodb://mongo:27017/reservas` mediante la red interna de Docker.

## Base de datos MongoDB Local (Sin dependencias de Atlas)

El proyecto está configurado para operar **exclusivamente con la base de datos MongoDB local** que se ejecuta en el contenedor Docker (`mongo:7.0`). No se requiere ninguna cuenta, cluster ni URI de MongoDB Atlas.

- **Imagen:** `mongo:7.0`
- **Puerto expuesto:** `27017:27017` (accesible en `mongodb://localhost:27017/reservas`)
- **Persistencia:** Los datos se conservan localmente en el volumen de Docker `mongo-data`.

### Puesta en marcha manual (Desarrollo local en host)

Si deseas ejecutar el backend o frontend directamente en tu máquina host sin ejecutar toda la pila en Docker:

1. Iniciar únicamente el servicio de MongoDB en Docker:

```bash
docker compose up -d mongo
```

2. Instalar dependencias de cada aplicación:

```bash
cd backend
npm install

cd ../frontend
npm install
```

3. El archivo `backend/.env` ya está listo para usar con MongoDB local:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/reservas
JWT_SECRET=desarrollo-local-secreto-seguro-123456
FRONTEND_URL=http://localhost:4200
```

*(Si no existe `backend/.env`, el backend utiliza automáticamente estos mismos valores por defecto al iniciar).*

4. Iniciar el backend:

```bash
cd backend
npm run dev
```

5. Iniciar el frontend en otra terminal:

```bash
cd frontend
npm start
```

La API expone `GET http://localhost:3000/api/health` para comprobar que el backend está activo.

## Convenciones de Código y Arquitectura

### 1. Convenciones de Nomenclatura

Conforme al requisito **RNF-05**, el sistema sigue un estándar estricto y uniforme de nombres para facilitar la mantenibilidad y consistencia del código:

| Elemento | Convención | Formato | Ejemplo |
| :--- | :--- | :--- | :--- |
| **Archivos Backend** | `kebab-case.tipo.js` | Minúsculas separadas por guiones | `error.middleware.js`, `negocios.controller.js`, `reservas.routes.js`, `reserva.model.js` |
| **Archivos Frontend** | `kebab-case.tipo.ts` | Minúsculas separadas por guiones | `error.interceptor.ts`, `api-response.model.ts`, `app.routes.ts`, `reserva.service.ts` |
| **Variables y Funciones** | `camelCase` | Inicio en minúscula, mayúscula por palabra | `fechaHoraReserva`, `calcularDisponibilidad()`, `obtenerPorId()` |
| **Variables Booleanas** | `camelCase` con prefijo semántico | `is*`, `has*`, `can*` | `isActivo`, `hasDisponibilidad`, `canCancelar` |
| **Clases, Modelos e Interfaces** | `PascalCase` | Inicio en mayúscula | `Negocio`, `Reserva`, `AppError`, `ValidationError`, `ApiResponse` |
| **Constantes y Configuración** | `UPPER_SNAKE_CASE` | Mayúsculas con guiones bajos | `JWT_SECRET`, `MONGODB_URI`, `DEFAULT_PORT` |
| **Rutas API (Endpoints HTTP)** | `kebab-case` plural en minúsculas | Prefijo versionado `/api/v1/...` | `/api/v1/negocios`, `/api/v1/negocios/:negocioId/servicios`, `/api/v1/reservas` |
| **Propiedades JSON** | `camelCase` | Claves en minúsculas camelCase | `{ "totalCupos": 10, "isReservado": false }` |

---

### 2. Estructura Estándar de Respuestas JSON y Errores

### 2.1 Roles y aislamiento por negocio

La API distingue tres roles:

- `superadmin`: administrador global del proyecto. No pertenece a un negocio
  (`negocioId` debe ser `null`) y puede operar sobre cualquier negocio.
- `admin`: administrador de un negocio específico. Debe tener un
  `negocioId`; las rutas protegidas deben usar el middleware de autorización
  para impedir el acceso a recursos de otros negocios.
- `cliente`: usuario final, sin `negocioId`.

Los tokens JWT de administradores de negocio incluyen `negocioId`. Los tokens
de `superadmin` no incluyen ese campo. La separación debe aplicarse tanto en
las consultas como en las escrituras: un administrador de negocio solo puede
leer o modificar documentos cuyo `negocioId` coincida con el de su token.

Toda la comunicación de la API REST utiliza un formato predecible y homogéneo tanto para operaciones exitosas como para fallos operacionales y de validación.

#### Respuestas Exitosas

```json
{
  "success": true,
  "data": {
    "id": "671fb2c09930f3a41c2ef38b",
    "nombre": "Corte de Cabello",
    "duracion": 30,
    "precio": 12000
  },
  "message": "Servicio registrado exitosamente"
}
```

Para colecciones y listados paginados:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

#### Respuestas de Error (HTTP y Validación)

Todo error devuelve `success: false` y un objeto `error` que encapsula el código legible (`code`), el mensaje legible (`message`) y opcionalmente un arreglo `details` para validaciones por campo:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error en los datos suministrados.",
    "details": [
      {
        "field": "email",
        "message": "El correo electrónico no es válido"
      },
      {
        "field": "duracion",
        "message": "La duración debe ser un número positivo"
      }
    ]
  }
}
```

#### Códigos de Error Estandarizados

- `BAD_REQUEST` (400): Sintaxis inválida o parámetros requeridos ausentes.
- `INVALID_JSON` (400): Cuerpo de petición no parseable por Express.
- `VALIDATION_ERROR` (400): Error de validación en datos (Mongoose o capa de servicios).
- `INVALID_IDENTIFIER` (400): Identificador `ObjectId` con formato erróneo.
- `UNAUTHORIZED` (401): Token JWT no proporcionado, inválido o expirado.
- `FORBIDDEN` (403): El usuario autenticado no posee los permisos o rol requerido.
- `NOT_FOUND` (404): Ruta inexistente o recurso no encontrado en el sistema.
- `CONFLICT` (409): Conflicto con el estado actual del recurso (ej. horario ya reservado).
- `DUPLICATE_KEY_ERROR` (409): Violación de índice único en MongoDB.
- `INTERNAL_SERVER_ERROR` (500): Error no controlado del servidor.

---

### 3. Formateo y Linting

El proyecto integra **ESLint** (con configuración plana moderna `eslint.config.js`) y **Prettier** para backend (Node.js) y frontend (Angular 22 + TypeScript).

#### Comandos en Backend

```bash
cd backend

# Ejecutar el linter para identificar errores de estilo o calidad de código
npm run lint

# Corregir automáticamente problemas reportados por el linter
npm run lint:fix

# Verificar formato con Prettier
npm run format:check

# Autoformatear todo el código con Prettier
npm run format

# Ejecutar las pruebas unitarias de manejo de errores
npm test
```

#### Comandos en Frontend

```bash
cd frontend

# Ejecutar ESLint para archivos TypeScript y plantillas HTML de Angular
npm run lint

# Corregir automáticamente problemas detectados
npm run lint:fix

# Verificar formateo de código
npm run format:check

# Autoformatear código y plantillas
npm run format
```

#### Ejecución de Linter y Pruebas dentro de Docker

Para verificar el cumplimiento del linter y pruebas directamente dentro de los contenedores en ejecución:

```bash
# Ejecutar linter del backend dentro del contenedor
docker compose exec backend npm run lint

# Ejecutar verificación de formato en el contenedor
docker compose exec backend npm run format:check

# Ejecutar pruebas unitarias de errores dentro del contenedor
docker compose exec backend npm test
```
# Almacenamiento de imágenes de negocios

El logotipo y la imagen de portada se almacenan como archivos en el directorio
`UPLOADS_DIR` del backend, no dentro de MongoDB. En Docker Compose este directorio
es `/app/uploads` y está respaldado por el volumen persistente `business-uploads`.
MongoDB conserva únicamente las rutas públicas `logoUrl` y `portadaUrl` asociadas
al documento del negocio.

Esta decisión evita aumentar el tamaño de los documentos de MongoDB y permite
servir las imágenes como archivos estáticos. El volumen debe conservarse al
actualizar los contenedores para no perder las imágenes.

Los administradores pueden cargar imágenes mediante `POST
/api/negocios/gestion/:negocioId/imagenes/:tipo`, usando el campo multipart
`imagen` y `tipo` `logo` o `portada`. El middleware limita cada archivo a 5 MB,
acepta PNG, JPG/JPEG y WebP, y comprueba la firma binaria real del archivo; no
se confía solo en la extensión ni en el MIME declarado por el navegador.

La personalización visual se administra con `GET /api/personalizacion` y
`PUT /api/personalizacion`. Estas rutas usan exclusivamente el `negocioId` del
JWT del administrador y aceptan únicamente `logo`, `portada`, `colorPrimario` y
`colorSecundario`. Las imágenes deben ser rutas generadas por el almacenamiento
del propio negocio; para quitarlas se envía `null`. Los colores aceptan
solamente hexadecimal de 3 o 6 dígitos, por ejemplo `#2F6F78`; enviar `null`
restaura el color por defecto. Cualquier otro campo, incluidos tamaños,
espaciado o estructura, se rechaza.
