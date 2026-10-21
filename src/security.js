const crypto = require('crypto');

const CATEGORIES = ['Pothole', 'Power outage', 'Water', 'Refuse', 'Other'];
const ESCALATIONS = ['Ward Councillor', 'PA Member Liaison', 'Regional Coordinator', 'Provincial Desk'];
const STAFF_ROLES = ['PA Member', 'Admin', 'Server Admin'];
const ASSIGNABLE_BY_ADMIN = ['PA Member', 'Admin'];
const ASSIGNABLE_BY_SERVER_ADMIN = ['PA Member', 'Admin', 'Server Admin'];

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

function safeReturnPath(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return '';
  if (trimmed.startsWith('//')) return '';
  if (trimmed.startsWith('/\\')) return '';
  if (trimmed.includes('\\') || trimmed.includes('\0')) return '';
  if (/[\s]/.test(trimmed)) return '';
  if (trimmed.includes('://')) return '';
  if (/[<>"']/.test(trimmed)) return '';
  if (/%2f|%5c/i.test(trimmed)) return '';
  if (trimmed.length > 300) return trimmed.slice(0, 300);
  return trimmed;
}

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function isEmail(value) {
  return typeof value === 'string' && value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPin(value) {
  return typeof value === 'string' && /^\d{4,8}$/.test(value);
}

function parseCoord(value, min, max) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return undefined;
  return Math.round(number * 1e6) / 1e6;
}

function sniffImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

function storedPhotoName(mime) {
  const extension = MIME_EXTENSIONS[mime];
  if (!extension) return null;
  return crypto.randomBytes(16).toString('hex') + extension;
}

function isSafePhotoName(name) {
  return typeof name === 'string' && /^[a-f0-9]{32}\.(jpg|png|webp|heic)$/.test(name);
}

function cleanHttpUrl(value) {
  const text = cleanText(value, 300);
  if (!text) return '';
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url.toString();
}

function idList(values) {
  const source = Array.isArray(values) ? values : values ? [values] : [];
  const ids = [];
  const seen = new Set();
  for (const value of source) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function tokensEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  CATEGORIES,
  ESCALATIONS,
  STAFF_ROLES,
  ASSIGNABLE_BY_ADMIN,
  ASSIGNABLE_BY_SERVER_ADMIN,
  MIME_EXTENSIONS,
  safeReturnPath,
  cleanText,
  isEmail,
  isPin,
  parseCoord,
  sniffImage,
  storedPhotoName,
  isSafePhotoName,
  cleanHttpUrl,
  idList,
  tokensEqual,
};
