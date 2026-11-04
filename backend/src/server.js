require('dotenv').config();

const cors = require('cors');
const express = require('express');
const { connectDatabase } = require('./database');
const { readConfig } = require('./config');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} = require('./errors/app.error');

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  }),
);
app.use(express.json());

// Endpoints base
app.get('/api/health', (_request, response) => {
  response.json({
    success: true,
    data: { status: 'ok' },
    status: 'ok',
  });
});

// Endpoint de demostración y prueba de estructura de errores
app.get('/api/v1/demo-errors', (request, response, next) => {
  const { type } = request.query;

  if (type === 'validation') {
    return next(
      new ValidationError('Error en los datos suministrados.', [
        { field: 'email', message: 'El correo electrónico no es válido' },
        { field: 'duracion', message: 'La duración debe ser un número positivo' },
      ]),
    );
  }

  if (type === 'unauthorized') {
    return next(new UnauthorizedError('Token no suministrado o expirado.'));
  }

  if (type === 'not-found') {
    return next(new NotFoundError('El recurso solicitado no fue encontrado.'));
  }

  if (type === 'conflict') {
    return next(new ConflictError('El horario seleccionado ya se encuentra reservado.'));
  }

  return response.json({
    success: true,
    data: {
      message: 'Estructura de respuesta exitosa estándar.',
    },
  });
});

// Rutas de autenticación
const authRoutes = require('./routes/auth.routes');
const negocioRoutes = require('./routes/negocio.routes');
const servicioRoutes = require('./routes/servicio.routes');
const disponibilidadRoutes = require('./routes/disponibilidad.routes');
const bloqueRoutes = require('./routes/bloque.routes');
const reservaRoutes = require('./routes/reserva.routes');
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/negocios', negocioRoutes);
app.use('/api', servicioRoutes);
app.use('/api', disponibilidadRoutes);
app.use('/api', bloqueRoutes);
app.use('/api', reservaRoutes);

// Manejo centralizado de rutas 404 y errores
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  const config = readConfig();

  await connectDatabase(config.mongodbUri);

  return app.listen(config.port, () => {
    console.log(`Backend listening on port ${config.port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`No se pudo iniciar el backend: ${error.message}`);
    process.exitCode = 1;
  });
}

app.startServer = startServer;

module.exports = app;
