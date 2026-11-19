const mongoose = require('mongoose');
const { cleanRubroLabel, normalizeRubroKey } = require('../utils/rubro.util');

const negocioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del negocio es requerido.'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres.'],
    },
    rubro: {
      type: String,
      required: [true, 'El rubro del negocio es requerido.'],
      trim: true,
    },
    rubroNormalizado: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'El slug del negocio es requerido.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones.'],
    },
    descripcion: {
      type: String,
      default: '',
      trim: true,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    portadaUrl: {
      type: String,
      default: '',
      trim: true,
    },
    personalizacion: {
      logo: {
        type: String,
        default: null,
      },
      portada: {
        type: String,
        default: null,
      },
      colorPrimario: {
        type: String,
        default: null,
      },
      colorSecundario: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

negocioSchema.pre('validate', function () {
  if (typeof this.rubro === 'string') {
    this.rubro = cleanRubroLabel(this.rubro);
    this.rubroNormalizado = normalizeRubroKey(this.rubro);
  }
});

const Negocio = mongoose.models.Negocio || mongoose.model('Negocio', negocioSchema);

module.exports = Negocio;
