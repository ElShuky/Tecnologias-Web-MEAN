const mongoose = require('mongoose');

const TIPOS_CAMPO_PERMITIDOS = [
  'texto_corto',
  'texto_largo',
  'numero',
  'fecha',
  'si_no',
  'seleccion_unica',
  'seleccion_multiple',
];

const campoFormularioSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'El id del campo es requerido.'],
      trim: true,
    },
    etiqueta: {
      type: String,
      required: [true, 'La etiqueta del campo es requerida.'],
      trim: true,
    },
    tipo: {
      type: String,
      required: [true, 'El tipo de dato del campo es requerido.'],
      enum: {
        values: TIPOS_CAMPO_PERMITIDOS,
        message: 'El tipo de campo no es permitido.',
      },
    },
    obligatorio: {
      type: Boolean,
      default: false,
    },
    textoAyuda: {
      type: String,
      default: '',
      trim: true,
    },
    opciones: {
      type: [String],
      default: [],
    },
    activo: {
      type: Boolean,
      default: true,
    },
    orden: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

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
    formulario: {
      type: [campoFormularioSchema],
      default: [],
      validate: {
        validator: function (campos) {
          return Array.isArray(campos) && campos.length <= 15;
        },
        message: 'El formulario no puede superar los 15 campos.',
      },
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

servicioSchema.index({ negocioId: 1, activo: 1 });

const Servicio = mongoose.models.Servicio || mongoose.model('Servicio', servicioSchema);

module.exports = Servicio;
