const mongoose = require('mongoose');
const { formatRubroLabel, normalizeRubroKey } = require('../utils/rubro.util');

const rubroSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del rubro es requerido.'],
      trim: true,
      minlength: [2, 'El nombre del rubro debe tener al menos 2 caracteres.'],
    },
    claveNormalizada: {
      type: String,
      required: [true, 'La clave normalizada del rubro es requerida.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

rubroSchema.pre('validate', function () {
  if (typeof this.nombre === 'string') {
    this.nombre = formatRubroLabel(this.nombre);
    this.claveNormalizada = normalizeRubroKey(this.nombre);
  }
});

const Rubro = mongoose.models.Rubro || mongoose.model('Rubro', rubroSchema);

module.exports = Rubro;
