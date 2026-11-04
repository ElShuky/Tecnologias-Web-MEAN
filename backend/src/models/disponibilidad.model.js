const mongoose = require('mongoose');

const DIAS_VALIDOS_TEXTO = [
  'lunes',
  'martes',
  'miercoles',
  'miércoles',
  'jueves',
  'viernes',
  'sabado',
  'sábado',
  'domingo',
];

const disponibilidadSchema = new mongoose.Schema(
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
    dias: {
      type: [mongoose.Schema.Types.Mixed],
      required: [true, 'Los días habilitados son requeridos.'],
      validate: {
        validator: function (val) {
          if (!Array.isArray(val) || val.length === 0) {
            return false;
          }
          return val.every((dia) => {
            if (typeof dia === 'number') {
              return Number.isInteger(dia) && dia >= 0 && dia <= 6;
            }
            if (typeof dia === 'string') {
              const normalizado = dia.trim().toLowerCase();
              const num = Number(normalizado);
              if (!Number.isNaN(num) && Number.isInteger(num)) {
                return num >= 0 && num <= 6;
              }
              return DIAS_VALIDOS_TEXTO.includes(normalizado);
            }
            return false;
          });
        },
        message:
          'Los días habilitados deben ser una lista no vacía con números de día (0 a 6) o nombres de días de la semana.',
      },
    },
    horaInicio: {
      type: String,
      required: [true, 'La hora de inicio es requerida.'],
      trim: true,
      match: [
        /^([01]\d|2[0-3]):[0-5]\d$/,
        'La hora de inicio debe tener formato válido HH:mm (ej. 09:00).',
      ],
    },
    horaFin: {
      type: String,
      required: [true, 'La hora de fin es requerida.'],
      trim: true,
      match: [
        /^([01]\d|2[0-3]):[0-5]\d$/,
        'La hora de fin debe tener formato válido HH:mm (ej. 18:00).',
      ],
      validate: {
        validator: function (v) {
          if (!this.horaInicio || !v) {
            return true;
          }
          return v > this.horaInicio;
        },
        message: 'La hora de fin debe ser posterior a la hora de inicio.',
      },
    },
  },
  {
    collection: 'disponibilidad',
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

disponibilidadSchema.index({ negocioId: 1, servicioId: 1 });

const Disponibilidad =
  mongoose.models.Disponibilidad ||
  mongoose.model('Disponibilidad', disponibilidadSchema, 'disponibilidad');

module.exports = Disponibilidad;
