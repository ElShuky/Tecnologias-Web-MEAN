const mongoose = require('mongoose');

const servicioSchema = new mongoose.Schema(
  {
    negocioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negocio',
      required: [true, 'El negocioId es requerido.'],
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del servicio es requerido.'],
      trim: true,
      minlength: [2, 'El nombre del servicio debe tener al menos 2 caracteres.'],
    },
    descripcion: {
      type: String,
      default: '',
      trim: true,
    },
    duracionMin: {
      type: Number,
      required: [true, 'La duración en minutos es requerida.'],
      min: [1, 'La duración debe ser de al menos 1 minuto.'],
      validate: {
        validator: Number.isInteger,
        message: 'La duración debe ser un número entero de minutos.',
      },
    },
    precio: {
      type: Number,
      required: [true, 'El precio del servicio es requerido.'],
      min: [0, 'El precio no puede ser negativo.'],
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

servicioSchema.index({ negocioId: 1, activo: 1 });

const Servicio = mongoose.models.Servicio || mongoose.model('Servicio', servicioSchema);

module.exports = Servicio;
