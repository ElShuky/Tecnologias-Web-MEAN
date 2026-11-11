const mongoose = require('mongoose');
const { Negocio, Servicio } = require('../models');
const { NotFoundError, ValidationError } = require('../errors/app.error');

const MAX_FIELDS = 15;
const SELECTION_TYPES = new Set(['seleccion_unica', 'seleccion_multiple']);

const FIELD_TYPES = new Map([
  ['texto_corto', 'texto_corto'],
  ['texto corto', 'texto_corto'],
  ['texto-corto', 'texto_corto'],
  ['texto_largo', 'texto_largo'],
  ['texto largo', 'texto_largo'],
  ['texto-largo', 'texto_largo'],
  ['numero', 'numero'],
  ['número', 'numero'],
  ['fecha', 'fecha'],
  ['si_no', 'si_no'],
  ['sí/no', 'si_no'],
  ['si/no', 'si_no'],
  ['sí_no', 'si_no'],
  ['si-no', 'si_no'],
  ['sí-no', 'si_no'],
  ['seleccion_unica', 'seleccion_unica'],
  ['selección única', 'seleccion_unica'],
  ['seleccion unica', 'seleccion_unica'],
  ['selección_única', 'seleccion_unica'],
  ['seleccion-unica', 'seleccion_unica'],
  ['selección-única', 'seleccion_unica'],
  ['seleccion_multiple', 'seleccion_multiple'],
  ['selección múltiple', 'seleccion_multiple'],
  ['seleccion multiple', 'seleccion_multiple'],
  ['selección_múltiple', 'seleccion_multiple'],
  ['seleccion-multiple', 'seleccion_multiple'],
  ['selección-múltiple', 'seleccion_multiple'],
]);

function ensureObjectId(value, field) {
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError('El identificador no es válido.', [
      { field, message: 'Debe ser un ObjectId válido.' },
    ]);
  }
}

function normalizeType(value) {
  if (typeof value !== 'string') {
    return null;
  }
  return FIELD_TYPES.get(value.trim().toLowerCase()) || null;
}

function extractFieldsInput(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.campos)) {
      return payload.campos;
    }
    if (Array.isArray(payload.formulario)) {
      return payload.formulario;
    }
    const keys = Object.keys(payload).filter((key) => key !== 'negocioId');
    if (keys.length === 0) {
      return [];
    }
  }
  throw new ValidationError('El formulario debe contener un arreglo de campos.', [
    { field: 'campos', message: 'Debe proporcionar un arreglo de campos.' },
  ]);
}

function validateAndNormalizeFields(payload) {
  const rawFields = extractFieldsInput(payload);

  if (rawFields.length > MAX_FIELDS) {
    throw new ValidationError('El formulario no puede superar los 15 campos.', [
      { field: 'campos', message: 'Un servicio puede tener como máximo 15 campos.' },
    ]);
  }

  const details = [];
  const seenLabels = new Set();
  const seenIds = new Set();
  const normalizedFields = [];

  rawFields.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      details.push({
        field: `campos[${index}]`,
        message: 'Cada campo debe ser un objeto válido.',
      });
      return;
    }

    let id = new mongoose.Types.ObjectId().toString();
    if (item.id !== undefined && item.id !== null && item.id !== '') {
      if (typeof item.id !== 'string' || !item.id.trim()) {
        details.push({
          field: `campos[${index}].id`,
          message: 'El id del campo debe ser un texto válido.',
        });
      } else {
        id = item.id.trim();
        if (seenIds.has(id)) {
          details.push({
            field: `campos[${index}].id`,
            message: 'El id del campo no puede repetirse dentro del formulario.',
          });
        }
        seenIds.add(id);
      }
    }

    const rawLabel = typeof item.etiqueta === 'string' ? item.etiqueta.trim() : '';
    if (!rawLabel) {
      details.push({
        field: `campos[${index}].etiqueta`,
        message: 'La etiqueta del campo es obligatoria.',
      });
    } else {
      const labelKey = rawLabel.toLowerCase();
      if (seenLabels.has(labelKey)) {
        details.push({
          field: `campos[${index}].etiqueta`,
          message: 'La etiqueta debe ser única dentro del formulario.',
        });
      }
      seenLabels.add(labelKey);
    }

    const tipo = normalizeType(item.tipo);
    if (!tipo) {
      details.push({
        field: `campos[${index}].tipo`,
        message:
          'El tipo de dato debe ser texto corto, texto largo, número, fecha, sí/no, selección única o selección múltiple.',
      });
    }

    const obligatorio = item.obligatorio ?? false;
    if (typeof obligatorio !== 'boolean') {
      details.push({
        field: `campos[${index}].obligatorio`,
        message: 'El indicador obligatorio debe ser booleano.',
      });
    }

    const textoAyuda =
      item.textoAyuda === undefined || item.textoAyuda === null ? '' : item.textoAyuda;
    if (typeof textoAyuda !== 'string') {
      details.push({
        field: `campos[${index}].textoAyuda`,
        message: 'El texto de ayuda debe ser una cadena de texto.',
      });
    }

    const activo = item.activo ?? true;
    if (typeof activo !== 'boolean') {
      details.push({
        field: `campos[${index}].activo`,
        message: 'El estado activo del campo debe ser booleano.',
      });
    }

    let opciones = [];
    if (tipo && SELECTION_TYPES.has(tipo)) {
      if (!Array.isArray(item.opciones) || item.opciones.length < 2) {
        details.push({
          field: `campos[${index}].opciones`,
          message: 'Las selecciones deben tener al menos dos opciones.',
        });
      } else {
        const trimmedOptions = [];
        const seenOptions = new Set();
        let hasInvalidOption = false;
        let hasDuplicateOption = false;

        for (const opt of item.opciones) {
          if (typeof opt !== 'string' || !opt.trim()) {
            hasInvalidOption = true;
            break;
          }
          const cleanOpt = opt.trim();
          const optKey = cleanOpt.toLowerCase();
          if (seenOptions.has(optKey)) {
            hasDuplicateOption = true;
          }
          seenOptions.add(optKey);
          trimmedOptions.push(cleanOpt);
        }

        if (hasInvalidOption) {
          details.push({
            field: `campos[${index}].opciones`,
            message: 'Todas las opciones deben ser textos no vacíos.',
          });
        } else if (hasDuplicateOption) {
          details.push({
            field: `campos[${index}].opciones`,
            message: 'Las opciones de selección no pueden repetirse.',
          });
        } else {
          opciones = trimmedOptions;
        }
      }
    } else if (item.opciones !== undefined && item.opciones !== null) {
      if (!Array.isArray(item.opciones) || item.opciones.length > 0) {
        details.push({
          field: `campos[${index}].opciones`,
          message: 'Solo los campos de selección pueden definir opciones.',
        });
      }
    }

    normalizedFields.push({
      id,
      etiqueta: rawLabel,
      tipo,
      obligatorio: Boolean(obligatorio),
      textoAyuda: typeof textoAyuda === 'string' ? textoAyuda.trim() : '',
      opciones,
      activo: Boolean(activo),
      orden: index,
    });
  });

  if (details.length > 0) {
    throw new ValidationError('Error de validación en el formulario del servicio.', details);
  }

  return normalizedFields;
}

function formatField(campo, index) {
  return {
    id: campo.id,
    etiqueta: campo.etiqueta,
    tipo: campo.tipo,
    obligatorio: Boolean(campo.obligatorio),
    textoAyuda: campo.textoAyuda || '',
    opciones: Array.isArray(campo.opciones) ? campo.opciones : [],
    activo: campo.activo !== false,
    orden: typeof campo.orden === 'number' ? campo.orden : index,
  };
}

async function obtenerFormularioPublico(servicioId) {
  ensureObjectId(servicioId, 'servicioId');
  const servicio = await Servicio.findOne({ _id: servicioId, activo: true })
    .select('negocioId formulario')
    .lean();
  if (!servicio) {
    throw new NotFoundError('El servicio solicitado no fue encontrado.');
  }

  const negocio = await Negocio.findOne({ _id: servicio.negocioId, activo: true })
    .select('_id')
    .lean();
  if (!negocio) {
    throw new NotFoundError('El servicio solicitado no fue encontrado.');
  }

  const campos = (servicio.formulario || [])
    .filter((campo) => campo.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((campo, idx) => formatField(campo, idx));

  return {
    servicioId: servicio._id.toString(),
    campos,
  };
}

async function obtenerFormularioGestion(negocioId, servicioId) {
  ensureObjectId(negocioId, 'negocioId');
  ensureObjectId(servicioId, 'servicioId');

  const servicio = await Servicio.findOne({ _id: servicioId, negocioId })
    .select('formulario')
    .lean();
  if (!servicio) {
    throw new NotFoundError('El servicio solicitado no pertenece a este negocio.');
  }

  const campos = (servicio.formulario || [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((campo, idx) => formatField(campo, idx));

  return {
    servicioId: servicio._id.toString(),
    campos,
  };
}

async function guardarFormulario(negocioId, servicioId, payload) {
  ensureObjectId(negocioId, 'negocioId');
  ensureObjectId(servicioId, 'servicioId');

  const existente = await Servicio.findOne({ _id: servicioId, negocioId }).select('_id').lean();
  if (!existente) {
    throw new NotFoundError('El servicio solicitado no pertenece a este negocio.');
  }

  const campos = validateAndNormalizeFields(payload);

  const servicio = await Servicio.findOneAndUpdate(
    { _id: servicioId, negocioId },
    { $set: { formulario: campos } },
    { returnDocument: 'after', runValidators: true },
  )
    .select('formulario')
    .lean();

  return {
    servicioId: servicio._id.toString(),
    campos: (servicio.formulario || []).map((campo, idx) => formatField(campo, idx)),
  };
}

module.exports = {
  obtenerFormularioPublico,
  obtenerFormularioGestion,
  guardarFormulario,
};
