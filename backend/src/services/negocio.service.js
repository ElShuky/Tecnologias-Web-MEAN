const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { Negocio, Rubro, Usuario } = require('../models');
const { readConfig } = require('../config');
const { ValidationError, ConflictError } = require('../errors/app.error');
const {
  cleanRubroLabel,
  formatRubroLabel,
  hasDiacritics,
  normalizeRubroKey,
} = require('../utils/rubro.util');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BCRYPT_SALT_ROUNDS = 10;

function publicBusiness(negocio) {
  const personalizacion = {
    logo: negocio.personalizacion?.logo || negocio.logoUrl || null,
    portada: negocio.personalizacion?.portada || negocio.portadaUrl || null,
    colorPrimario: negocio.personalizacion?.colorPrimario || null,
    colorSecundario: negocio.personalizacion?.colorSecundario || null,
  };
  return {
    id: negocio._id.toString(),
    nombre: negocio.nombre,
    rubro: negocio.rubro,
    slug: negocio.slug,
    descripcion: negocio.descripcion,
    enlacePublico: `${readConfig().frontendUrl}/negocios/${negocio.slug}`,
    logoUrl: personalizacion.logo || '',
    portadaUrl: personalizacion.portada || '',
    personalizacion,
  };
}

async function resolveOrCreateRubro(rawRubro, session) {
  const clave = normalizeRubroKey(rawRubro);
  let canonicalNombre = formatRubroLabel(rawRubro);

  const existente = await Rubro.findOne({ claveNormalizada: clave }).session(session);
  if (existente) {
    return existente;
  }

  const legacyNegocios = await Negocio.find({ activo: true })
    .select('rubro rubroNormalizado')
    .sort({ creadoEn: 1 })
    .session(session)
    .lean();
  const matches = legacyNegocios.filter(
    (item) => normalizeRubroKey(item.rubroNormalizado || item.rubro) === clave,
  );
  if (matches.length > 0) {
    const preferred = matches.find((item) => hasDiacritics(item.rubro)) || matches[0];
    canonicalNombre = formatRubroLabel(preferred.rubro) || canonicalNombre;
  }

  try {
    return await Rubro.findOneAndUpdate(
      { claveNormalizada: clave },
      {
        $setOnInsert: {
          nombre: canonicalNombre,
          claveNormalizada: clave,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
        setDefaultsOnInsert: true,
        session,
      },
    );
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.claveNormalizada) {
      return Rubro.findOne({ claveNormalizada: clave }).session(session);
    }
    throw error;
  }
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
  if (
    !rubro ||
    typeof rubro !== 'string' ||
    cleanRubroLabel(rubro).length < 2 ||
    normalizeRubroKey(rubro).length < 2
  ) {
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
  await Rubro.init();
  const session = await mongoose.startSession();

  try {
    let negocioCreado;
    await session.withTransaction(async () => {
      const rubroDoc = await resolveOrCreateRubro(rubro, session);
      const [negocio] = await Negocio.create(
        [
          {
            nombre: nombre.trim(),
            rubro: rubroDoc.nombre,
            rubroNormalizado: rubroDoc.claveNormalizada,
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
  const conditions = [{ activo: true }];
  if (typeof search === 'string' && search.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({
      $or: [
        { nombre: { $regex: escapedSearch, $options: 'i' } },
        { descripcion: { $regex: escapedSearch, $options: 'i' } },
      ],
    });
  }

  let normalizedRubro = '';
  if (typeof rubro === 'string' && rubro.trim()) {
    normalizedRubro = normalizeRubroKey(rubro);
    if (!normalizedRubro) {
      return [];
    }
    conditions.push({
      $or: [
        { rubroNormalizado: normalizedRubro },
        { rubroNormalizado: { $exists: false } },
        { rubroNormalizado: null },
        { rubroNormalizado: '' },
      ],
    });
  }

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
  const negocios = await Negocio.find(filter)
    .select('nombre rubro rubroNormalizado slug descripcion logoUrl portadaUrl personalizacion')
    .sort({ nombre: 1 })
    .lean();

  const matched = normalizedRubro
    ? negocios.filter(
        (negocio) =>
          normalizeRubroKey(negocio.rubroNormalizado || negocio.rubro) === normalizedRubro,
      )
    : negocios;

  return matched.map(publicBusiness);
}

async function listarRubros() {
  const [negociosActivos, rubrosCatalogo] = await Promise.all([
    Negocio.find({ activo: true }).select('rubro rubroNormalizado').sort({ creadoEn: 1 }).lean(),
    Rubro.find().select('nombre claveNormalizada').lean(),
  ]);

  const rubrosPorClave = new Map();
  for (const rubro of rubrosCatalogo) {
    if (rubro.claveNormalizada && rubro.nombre) {
      rubrosPorClave.set(rubro.claveNormalizada, rubro.nombre);
    }
  }

  const activosPorClave = new Map();
  const faltantesEnCatalogo = new Map();

  for (const negocio of negociosActivos) {
    const clave = normalizeRubroKey(negocio.rubroNormalizado || negocio.rubro);
    if (!clave) {
      continue;
    }

    if (rubrosPorClave.has(clave)) {
      activosPorClave.set(clave, rubrosPorClave.get(clave));
      continue;
    }

    const candidato = formatRubroLabel(negocio.rubro);
    if (!candidato) {
      continue;
    }

    const actual = activosPorClave.get(clave);
    if (!actual || (!hasDiacritics(actual) && hasDiacritics(candidato))) {
      activosPorClave.set(clave, candidato);
      faltantesEnCatalogo.set(clave, candidato);
    }
  }

  if (faltantesEnCatalogo.size > 0) {
    await Promise.all(
      Array.from(faltantesEnCatalogo.entries()).map(([clave, nombre]) =>
        Rubro.findOneAndUpdate(
          { claveNormalizada: clave },
          { $setOnInsert: { nombre, claveNormalizada: clave } },
          {
            upsert: true,
            returnDocument: 'after',
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        ).catch((error) => {
          if (error.code !== 11000) {
            throw error;
          }
        }),
      ),
    );
  }

  return Array.from(activosPorClave.entries())
    .map(([clave, nombre]) => ({ clave, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

async function obtenerNegocioPublico(slug) {
  const negocio = await Negocio.findOne({ slug: slug.trim().toLowerCase(), activo: true })
    .select('nombre rubro slug descripcion logoUrl portadaUrl personalizacion')
    .lean();
  return negocio ? publicBusiness(negocio) : null;
}

async function obtenerNegocioPorId(negocioId) {
  const negocio = await Negocio.findOne({ _id: negocioId, activo: true })
    .select('nombre rubro slug descripcion logoUrl portadaUrl personalizacion')
    .lean();
  return negocio ? publicBusiness(negocio) : null;
}

module.exports = {
  registrarNegocio,
  listarNegocios,
  listarRubros,
  obtenerNegocioPublico,
  obtenerNegocioPorId,
};
