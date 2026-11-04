const mongoose = require('mongoose');

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
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

const Negocio = mongoose.models.Negocio || mongoose.model('Negocio', negocioSchema);

module.exports = Negocio;
