const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { Negocio, Usuario } = require('../models');
const { readConfig } = require('../config');
const { ValidationError, ConflictError } = require('../errors/app.error');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BCRYPT_SALT_ROUNDS = 10;

function publicBusiness(negocio) {
  return {
    id: negocio._id.toString(),
    nombre: negocio.nombre,
    rubro: negocio.rubro,
    slug: negocio.slug,
    descripcion: negocio.descripcion,
    enlacePublico: `${readConfig().frontendUrl}/negocios/${negocio.slug}`,
  };
}

async function registrarNegocio({
  nombre,
  rubro,
  slug,
  descripcion,
  adminNombre,
  adminCorreo,
  adminPassword,
}) {
  const details = [];
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    details.push({ field: 'nombre', message: 'El nombre debe tener al menos 2 caracteres.' });
  }
  if (!rubro || typeof rubro !== 'string' || rubro.trim().length < 2) {
    details.push({ field: 'rubro', message: 'El rubro es requerido.' });
  }
  if (!slug || typeof slug !== 'string' || !SLUG_REGEX.test(slug.trim().toLowerCase())) {
    details.push({
      field: 'slug',
      message: 'El slug solo puede contener letras minúsculas, números y guiones.',
    });
  }
  if (!adminNombre || typeof adminNombre !== 'string' || adminNombre.trim().length < 2) {
    details.push({ field: 'adminNombre', message: 'El nombre del administrador es requerido.' });
  }
  if (!adminCorreo || typeof adminCorreo !== 'string' || !EMAIL_REGEX.test(adminCorreo.trim())) {
    details.push({ field: 'adminCorreo', message: 'El correo del administrador no es válido.' });
  }
  if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.length < 8) {
    details.push({
      field: 'adminPassword',
      message: 'La contraseña debe tener al menos 8 caracteres.',
    });
  }
  if (details.length > 0) {
    throw new ValidationError('Error de validación del negocio.', details);
  }

  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedEmail = adminCorreo.trim().toLowerCase();
  const session = await mongoose.startSession();

  try {
    let negocioCreado;
    await session.withTransaction(async () => {
      const [negocio] = await Negocio.create(
        [
          {
            nombre: nombre.trim(),
            rubro: rubro.trim(),
            slug: normalizedSlug,
            descripcion: descripcion || '',
          },
        ],
        { session },
      );
      const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);
      await Usuario.create(
        [
          {
            nombre: adminNombre.trim(),
            correo: normalizedEmail,
            passwordHash,
            rol: 'admin',
            negocioId: negocio._id,
          },
        ],
        { session },
      );
      negocioCreado = negocio;
    });

    return publicBusiness(negocioCreado);
  } catch (error) {
    if (error.code === 11000) {
      const duplicatedField = Object.keys(error.keyPattern || {})[0];
      throw new ConflictError(
        duplicatedField === 'slug'
          ? 'El slug del negocio ya se encuentra utilizado.'
          : 'El correo del administrador ya se encuentra registrado.',
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function listarNegocios({ search, rubro } = {}) {
  const filter = { activo: true };
  if (typeof search === 'string' && search.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { nombre: { $regex: escapedSearch, $options: 'i' } },
      { descripcion: { $regex: escapedSearch, $options: 'i' } },
    ];
  }
  if (typeof rubro === 'string' && rubro.trim()) {
    filter.rubro = {
      $regex: `^${rubro.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      $options: 'i',
    };
  }
  const negocios = await Negocio.find(filter)
    .select('nombre rubro slug descripcion')
    .sort({ nombre: 1 })
    .lean();
  return negocios.map(publicBusiness);
}

async function obtenerNegocioPublico(slug) {
  const negocio = await Negocio.findOne({ slug: slug.trim().toLowerCase(), activo: true })
    .select('nombre rubro slug descripcion')
    .lean();
  return negocio ? publicBusiness(negocio) : null;
}

module.exports = {
  registrarNegocio,
  listarNegocios,
  obtenerNegocioPublico,
};
