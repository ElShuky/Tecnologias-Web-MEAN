const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido.'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres.'],
    },
    correo: {
      type: String,
      required: [true, 'El correo electrónico es requerido.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El correo electrónico no es válido.'],
    },
    passwordHash: {
      type: String,
      required: [true, 'La contraseña cifrada es requerida.'],
    },
    rol: {
      type: String,
      enum: {
        values: ['cliente', 'admin', 'superadmin'],
        message: 'El rol debe ser "cliente", "admin" o "superadmin".',
      },
      default: 'cliente',
      required: true,
    },
    negocioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negocio',
      default: null,
      validate: {
        validator: function (v) {
          if (this.rol === 'admin') {
            return Boolean(v) && mongoose.Types.ObjectId.isValid(v);
          }
          if (this.rol === 'cliente' || this.rol === 'superadmin') {
            return v === null || v === undefined;
          }
          return true;
        },
        message:
          'El negocioId es obligatorio para administradores de negocio y debe estar vacío en clientes o superadministradores.',
      },
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  },
);

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;
