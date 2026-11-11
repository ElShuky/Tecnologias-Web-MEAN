const mongoose = require('mongoose');

const seguimientoSchema = new mongoose.Schema(
  {
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    negocioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negocio',
      required: true,
    },
  },
  { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } },
);

seguimientoSchema.index({ clienteId: 1, negocioId: 1 }, { unique: true });

const Seguimiento = mongoose.models.Seguimiento || mongoose.model('Seguimiento', seguimientoSchema);

module.exports = Seguimiento;
