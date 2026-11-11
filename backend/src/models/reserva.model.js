const mongoose = require('mongoose');

const respuestaReservaSchema = new mongoose.Schema(
  {
    campoId: {
      type: String,
      required: [true, 'El identificador del campo es requerido.'],
      trim: true,
    },
    etiqueta: {
      type: String,
      required: [true, 'La etiqueta del campo es requerida.'],
      trim: true,
    },
    tipo: {
      type: String,
      required: [true, 'El tipo del campo es requerido.'],
      enum: {
        values: [
          'texto_corto',
          'texto_largo',
          'numero',
          'fecha',
          'si_no',
          'seleccion_unica',
          'seleccion_multiple',
        ],
        message: 'El tipo de campo en la respuesta no es válido.',
      },
    },
    valor: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'El valor de la respuesta es requerido.'],
    },
  },
  { _id: false },
);

const reservaSchema = new mongoose.Schema(
  {
    negocioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negocio',
      required: [true, 'El negocioId es requerido.'],
    },
    servicioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Servicio',
      required: [true, 'El servicioId es requerido.'],
    },
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El clienteId es requerido.'],
    },
    fecha: {
      type: String,
      required: [true, 'La fecha es requerida.'],
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD (ej. 2026-10-07).'],
      validate: {
        validator: function (v) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            return false;
          }
          const [anio, mes, dia] = v.split('-').map(Number);
          const fechaObj = new Date(anio, mes - 1, dia);
          return (
            fechaObj.getFullYear() === anio &&
            fechaObj.getMonth() === mes - 1 &&
            fechaObj.getDate() === dia
          );
        },
        message: 'La fecha proporcionada no es una fecha válida en el calendario.',
      },
    },
    hora: {
      type: String,
      required: [true, 'La hora es requerida.'],
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener el formato HH:mm (ej. 10:30).'],
    },
    estado: {
      type: String,
      enum: {
        values: ['confirmada', 'cancelada'],
        message: 'El estado debe ser "confirmada" o "cancelada".',
      },
      default: 'confirmada',
      required: true,
    },
    notas: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Las notas no pueden exceder los 500 caracteres.'],
    },
    respuestas: {
      type: [respuestaReservaSchema],
      default: [],
    },
  },
  {
    collection: 'reservas',
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

// Índice compuesto único para impedir el doble cupo en reservas activas (RF-12, RNF-03)
reservaSchema.index(
  { negocioId: 1, servicioId: 1, fecha: 1, hora: 1 },
  {
    unique: true,
    partialFilterExpression: { estado: 'confirmada' },
  },
);

// Índices para consultas de agenda del administrador y reservas del cliente
reservaSchema.index({ negocioId: 1, fecha: 1 });
reservaSchema.index({ clienteId: 1, fecha: 1 });

const Reserva = mongoose.models.Reserva || mongoose.model('Reserva', reservaSchema);

module.exports = Reserva;
