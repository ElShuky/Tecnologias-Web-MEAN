# Sistema de reservas MEAN

Aplicación web de reservas construida con MongoDB, Express, Angular y Node.js.

## Estructura

- `backend/`: API REST con Node.js y Express.
- `frontend/`: aplicación SPA con Angular.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- MongoDB será necesario desde la tarea T-02.

## Puesta en marcha

Instalar dependencias de cada aplicación:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

Iniciar el backend:

```powershell
cd backend
npm run dev
```

Iniciar el frontend en otra terminal:

```powershell
cd frontend
npm start
```

La API expone `GET http://localhost:3000/api/health` para comprobar que el backend está activo.