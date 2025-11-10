'use strict';

const crypto = require('crypto');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT_SCOPE_NAMESPACE = 'rec2pdf:knowledge:project:';
const CONTEXT_SEPARATOR = '\n\n---\n\n';

const formatUuidFromBytes = (bytes) => {
  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const deterministicUuidFromString = (value) => {
  const hash = crypto.createHash('sha1').update(PROJECT_SCOPE_NAMESPACE).update(value).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuidFromBytes(bytes);
};

const sanitizeProjectIdentifier = (value) => {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  return (raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') ? '' : raw;
};

const canonicalizeProjectScopeId = (value) => {
  const sanitized = sanitizeProjectIdentifier(value);
  if (!sanitized) return '';
  const normalized = sanitized.toLowerCase();
  if (UUID_REGEX.test(normalized)) return normalized;
  return deterministicUuidFromString(normalized);
};

// Esportiamo tutto ciò che può servire all'esterno
module.exports = {
  UUID_REGEX,
  PROJECT_SCOPE_NAMESPACE,
  formatUuidFromBytes,
  deterministicUuidFromString,
  sanitizeProjectIdentifier,
  canonicalizeProjectScopeId,
};