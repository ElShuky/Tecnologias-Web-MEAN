require('dotenv').config();

const bcrypt = require('bcrypt');
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const mongoose = require('mongoose');
const { readConfig } = require('./config');
const { connectDatabase } = require('./database');
const { Negocio, Rubro, Usuario, Servicio, Disponibilidad } = require('./models');
const formularioService = require('./services/formulario.service');
const { normalizeRubroKey } = require('./utils/rubro.util');

const DEMO_PASSWORD = 'Password123';
const SALT_ROUNDS = 10;

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPngBuffer(width, height, pixelFn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = pixelFn(x, y, width, height);
      const idx = rowStart + 1 + x * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function ensureDemoImages(uploadsDir, negocioId) {
  const logosDir = path.join(uploadsDir, 'logos');
  const portadasDir = path.join(uploadsDir, 'portadas');
  await fs.mkdir(logosDir, { recursive: true });
  await fs.mkdir(portadasDir, { recursive: true });

  const logoFilename = `${negocioId}-barberia-logo.png`;
  const portadaFilename = `${negocioId}-barberia-portada.png`;

  const logoBuffer = createPngBuffer(160, 160, (x, y, w, h) => {
    const dx = x - w / 2;
    const dy = y - h / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > w * 0.44 && dist < w * 0.48) {
      return [200, 125, 50, 255];
    }
    const stripe = (x + y) % 36 < 18;
    if (dist < w * 0.28) {
      return stripe ? [200, 125, 50, 255] : [245, 238, 228, 255];
    }
    return [27, 59, 75, 255];
  });

  const portadaBuffer = createPngBuffer(640, 220, (x, y, w, h) => {
    const t = x / w;
    const u = y / h;
    const stripe = (x + y * 2) % 90 < 8;
    if (stripe) {
      return [200, 125, 50, 255];
    }
    const r = Math.round(27 * (1 - t * 0.4) + 55 * u);
    const g = Math.round(59 * (1 - t * 0.25) + 45 * u);
    const b = Math.round(75 * (1 - t * 0.2) + 35 * u);
    return [r, g, b, 255];
  });

  await fs.writeFile(path.join(logosDir, logoFilename), logoBuffer);
  await fs.writeFile(path.join(portadasDir, portadaFilename), portadaBuffer);

  return {
    logoUrl: `/uploads/logos/${logoFilename}`,
    portadaUrl: `/uploads/portadas/${portadaFilename}`,
  };
}

async function seedDemoData() {
  const { mongodbUri, uploadsDir } = readConfig();
  await connectDatabase(mongodbUri);

  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

    let negocio = await Negocio.findOneAndUpdate(
      { slug: 'barberia-central' },
      {
        $setOnInsert: {
          nombre: 'Barbería Central',
          rubro: 'Estética',
          rubroNormalizado: normalizeRubroKey('Estética'),
          slug: 'barberia-central',
          descripcion: 'Cortes clásicos, perfilado de barba y cuidado personal.',
          activo: true,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    const demoImages = await ensureDemoImages(uploadsDir, negocio._id.toString());
    const currentLogo = negocio.personalizacion?.logo || negocio.logoUrl || demoImages.logoUrl;
    const currentPortada =
      negocio.personalizacion?.portada || negocio.portadaUrl || demoImages.portadaUrl;
    const currentPrimary = negocio.personalizacion?.colorPrimario || '#1B3B4B';
    const currentSecondary = negocio.personalizacion?.colorSecundario || '#C87D32';

    negocio = await Negocio.findOneAndUpdate(
      { _id: negocio._id },
      {
        $set: {
          activo: true,
          rubroNormalizado: normalizeRubroKey(negocio.rubro),
          logoUrl: currentLogo,
          portadaUrl: currentPortada,
          personalizacion: {
            logo: currentLogo,
            portada: currentPortada,
            colorPrimario: currentPrimary,
            colorSecundario: currentSecondary,
          },
        },
      },
      { returnDocument: 'after' },
    );

    await Rubro.findOneAndUpdate(
      { claveNormalizada: normalizeRubroKey('Estética') },
      {
        $setOnInsert: {
          nombre: 'Estética',
          claveNormalizada: normalizeRubroKey('Estética'),
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    const servicio = await Servicio.findOneAndUpdate(
      { negocioId: negocio._id, nombre: 'Corte y Barba' },
      {
        $set: {
          negocioId: negocio._id,
          nombre: 'Corte y Barba',
          descripcion: 'Corte personalizado con perfilado de barba y toalla caliente.',
          duracionMin: 30,
          precio: 12000,
          activo: true,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    if (!servicio.formulario || servicio.formulario.length === 0) {
      await formularioService.guardarFormulario(negocio._id.toString(), servicio._id.toString(), {
        campos: [
          {
            etiqueta: 'Estilo de corte preferido',
            tipo: 'seleccion_unica',
            obligatorio: true,
            textoAyuda: 'Selecciona el estilo principal que buscas.',
            opciones: ['Degradado (Fade)', 'Clásico con tijera', 'Texturizado moderno'],
          },
          {
            etiqueta: '¿Incluir perfilado de cejas?',
            tipo: 'si_no',
            obligatorio: false,
            textoAyuda: 'Sin costo adicional durante la sesión.',
          },
          {
            etiqueta: 'Indicaciones adicionales para el barbero',
            tipo: 'texto_largo',
            obligatorio: false,
            textoAyuda: 'Comenta remolinos, largo superior o preferencias.',
          },
        ],
      });
    }

    await Disponibilidad.findOneAndUpdate(
      { negocioId: negocio._id, servicioId: servicio._id },
      {
        $set: {
          negocioId: negocio._id,
          servicioId: servicio._id,
          dias: [1, 2, 3, 4, 5, 6],
          horaInicio: '09:00',
          horaFin: '18:00',
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    const segundoServicio = await Servicio.findOneAndUpdate(
      { negocioId: negocio._id, nombre: 'Ritual de Barba y Spa Facial' },
      {
        $set: {
          negocioId: negocio._id,
          nombre: 'Ritual de Barba y Spa Facial',
          descripcion: 'Hidratación profunda, exfoliación con vapor de ozono y afeitado clásico.',
          duracionMin: 45,
          precio: 16000,
          activo: true,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    if (!segundoServicio.formulario || segundoServicio.formulario.length === 0) {
      await formularioService.guardarFormulario(
        negocio._id.toString(),
        segundoServicio._id.toString(),
        {
          campos: [
            {
              etiqueta: 'Tipo de piel o sensibilidad',
              tipo: 'texto_corto',
              obligatorio: true,
              textoAyuda: 'Ej. piel sensible, seca o tendencia a irritación.',
            },
            {
              etiqueta: 'Tratamientos adicionales deseados',
              tipo: 'seleccion_multiple',
              obligatorio: false,
              textoAyuda: 'Puedes elegir más de una opción.',
              opciones: ['Mascarilla negra', 'Aceite esencial de cedro', 'Compresa fría final'],
            },
            {
              etiqueta: '¿Presenta alergia a fragancias o mentol?',
              tipo: 'si_no',
              obligatorio: true,
            },
          ],
        },
      );
    }

    await Disponibilidad.findOneAndUpdate(
      { negocioId: negocio._id, servicioId: segundoServicio._id },
      {
        $set: {
          negocioId: negocio._id,
          servicioId: segundoServicio._id,
          dias: [1, 2, 3, 4, 5, 6],
          horaInicio: '10:00',
          horaFin: '19:00',
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    const cliente = await Usuario.findOneAndUpdate(
      { correo: 'cliente@demo.cl' },
      {
        $set: {
          nombre: 'Cliente Demo',
          correo: 'cliente@demo.cl',
          passwordHash,
          rol: 'cliente',
          negocioId: null,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    const admin = await Usuario.findOneAndUpdate(
      { correo: 'admin@demo.cl' },
      {
        $set: {
          nombre: 'Admin Barbería',
          correo: 'admin@demo.cl',
          passwordHash,
          rol: 'admin',
          negocioId: negocio._id,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    const superadmin = await Usuario.findOneAndUpdate(
      { correo: 'superadmin@demo.cl' },
      {
        $set: {
          nombre: 'Superadmin Global',
          correo: 'superadmin@demo.cl',
          passwordHash,
          rol: 'superadmin',
          negocioId: null,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );

    console.log('Usuarios y negocio de prueba creados/actualizados en MongoDB:');
    console.table([
      {
        rol: cliente.rol,
        correo: cliente.correo,
        password: DEMO_PASSWORD,
        negocio: '-',
      },
      {
        rol: admin.rol,
        correo: admin.correo,
        password: DEMO_PASSWORD,
        negocio: `${negocio.nombre} (${negocio.slug})`,
      },
      {
        rol: superadmin.rol,
        correo: superadmin.correo,
        password: DEMO_PASSWORD,
        negocio: 'Global (todos)',
      },
    ]);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedDemoData().catch((error) => {
    console.error(`Error al poblar datos de prueba: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { seedDemoData };
