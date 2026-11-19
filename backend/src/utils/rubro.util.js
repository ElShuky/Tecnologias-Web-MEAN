function cleanRubroLabel(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\s+/g, ' ');
}

function hasDiacritics(value) {
  return typeof value === 'string' && /[\u0300-\u036f]/.test(value.normalize('NFD'));
}

function formatRubroLabel(value) {
  const cleaned = cleanRubroLabel(value);
  if (!cleaned) {
    return '';
  }

  const lower = cleaned.toLocaleLowerCase('es');
  const upper = cleaned.toLocaleUpperCase('es');
  if (cleaned === lower || (cleaned === upper && cleaned.length > 3)) {
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  }

  return cleaned;
}

function normalizeRubroToken(token) {
  if (typeof token !== 'string' || token.length < 4) {
    return token || '';
  }

  let word = token;

  if (word.length >= 5 && /[aeiou]ces$/.test(word)) {
    word = `${word.slice(0, -3)}z`;
  } else if (
    word.length >= 5 &&
    (/(?:[dt]ad|[oae]n)es$/.test(word) || /(?:^|[^aeiou])[aeiou][lr]es$/.test(word))
  ) {
    word = word.slice(0, -2);
  } else if (
    word.endsWith('s') &&
    !word.endsWith('ss') &&
    !word.endsWith('is') &&
    !word.endsWith('us')
  ) {
    word = word.slice(0, -1);
  }

  if (word.length >= 4 && word.endsWith('a')) {
    word = `${word.slice(0, -1)}o`;
  }

  return word;
}

function normalizeRubroKey(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) {
    return '';
  }

  return cleaned.split(' ').map(normalizeRubroToken).join(' ');
}

module.exports = {
  cleanRubroLabel,
  hasDiacritics,
  formatRubroLabel,
  normalizeRubroToken,
  normalizeRubroKey,
};
