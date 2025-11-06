import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Mic, Square, Settings, Folder, FileText, FileCode, Cpu, Download, TimerIcon, Waves, CheckCircle2, AlertCircle, LinkIcon, Upload, RefreshCw, Bug, XCircle, Info, Maximize, Sparkles, Plus, Users } from "./components/icons";
import AppShell from "./components/layout/AppShell";
import CreatePage from "./pages/Create";
import AdvancedPage from "./pages/Advanced";
import LibraryPage from "./pages/Library";
import EditorPage from "./pages/Editor";
import { useMicrophoneAccess } from "./hooks/useMicrophoneAccess";
import { useBackendDiagnostics } from "./hooks/useBackendDiagnostics";
import { pickBestMime } from "./utils/media";
import { normalizeRefinedDataForUpload } from "./utils/refinedData.js";
import LoginPage from "./components/LoginPage";
import supabase from "./supabaseClient";
import { AppProvider } from "./hooks/useAppContext";
import { ModeProvider, useMode } from "./context/ModeContext";
import { useAnalytics } from "./context/AnalyticsContext";
import {
  collectPromptIdentifiers,
  findPromptByIdentifier,
  normalizePromptEntry,
  parsePromptResponse,
  parsePromptsResponse,
  removePromptEntry,
  upsertPromptEntry,
} from "./api/prompts.js";
import { PromptsProvider } from "./context/PromptsContext.jsx";
import {
  DEFAULT_WORKSPACE_STATUSES,
  parseWorkspaceResponse,
  parseWorkspacesResponse,
} from "./api/workspaces.js";
import {
  buildPreAnalyzeRequest,
  postPreAnalyze,
} from "./api/preAnalyze.js";

const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:7788';
const DEFAULT_DEST_DIR = '/Users/';
const BYPASS_AUTH = import.meta.env.MODE === 'test' || import.meta.env.VITE_BYPASS_AUTH === 'true';

const isDestDirPlaceholder = (value) => {
  const sanitized = (value ?? '').trim();
  if (!sanitized) {
    return true;
  }
  if (sanitized === DEFAULT_DEST_DIR) {
    return true;
  }
  if (sanitized === DEFAULT_DEST_DIR.replace(/\/$/, '')) {
    return true;
  }
  const lowerSanitized = sanitized.toLowerCase();
  if (lowerSanitized === 'users/' || lowerSanitized === 'users') {
    return true;
  }
  if (sanitized.includes('tuo_utente')) {
    return true;
  }
  return false;
};
const DEST_DIR_STORAGE_KEY = 'rec2pdfDestinationDir';

const normalizeQuoteCharacters = (value) =>
  value
    .replace(/[\u2018\u2019\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u2033\u2036]/g, '"')
    .replace(/[\u02BC\u02BD]/g, "'");

const stripWrappingQuotes = (value) => {
  const pairs = [
    ["'", "'"],
    ['"', '"'],
    ['`', '`'],
  ];

  let trimmed = value.trim();
  let changed = false;

  do {
    changed = false;
    for (const [start, end] of pairs) {
      if (trimmed.length >= 2 && trimmed.startsWith(start) && trimmed.endsWith(end)) {
        trimmed = trimmed.slice(start.length, trimmed.length - end.length).trim();
        changed = true;
      }
    }
  } while (changed);

  if (trimmed.startsWith("'") || trimmed.startsWith('"') || trimmed.startsWith('`')) {
    trimmed = trimmed.slice(1).trim();
  }
  if (trimmed.endsWith("'") || trimmed.endsWith('"') || trimmed.endsWith('`')) {
    trimmed = trimmed.slice(0, -1).trim();
  }

  return trimmed;
};

const sanitizeDestDirForRequest = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalizedQuotes = normalizeQuoteCharacters(value);
  const trimmed = stripWrappingQuotes(normalizedQuotes);

  if (!trimmed) {
    return '';
  }
  if (isDestDirPlaceholder(trimmed)) {
    return '';
  }
  return trimmed.replace(/\\+/g, '/');
};

const fmtBytes = (bytes) => { if (!bytes && bytes !== 0) return "—"; const u=["B","KB","MB","GB"]; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(v<10&&i>0?1:0)} ${u[i]}`; };
const fmtTime = (s) => { const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=Math.floor(s%60); return [h,m,sec].map(n=>String(n).padStart(2,'0')).join(":"); };
const HISTORY_STORAGE_KEY = 'rec2pdfHistory';
const HISTORY_LIMIT = 100;
const WORKSPACE_SELECTION_KEY = 'rec2pdfWorkspaceSelection';
const WORKSPACE_FILTERS_KEY = 'rec2pdfWorkspaceFilters';
const PROMPT_SELECTION_KEY = 'rec2pdfPromptSelection';
const PROMPT_FAVORITES_KEY = 'rec2pdfPromptFavorites';
const PDF_TEMPLATE_SELECTION_KEY = 'rec2pdfPdfTemplateSelection';
const AI_PROVIDER_PREFERENCES_KEY = 'rec2pdfAiPreferences';
const AI_PROVIDER_PREFERENCES_VERSION = 2;
const HISTORY_TABS = [
  { key: 'history', label: 'Cronologia' },
  { key: 'cloud', label: 'Cloud library' },
];
const EMPTY_EDITOR_STATE = {
  open: false,
  entry: null,
  path: '',
  backendUrl: '',
  content: '',
  originalContent: '',
  loading: false,
  saving: false,
  error: '',
  success: '',
  lastAction: 'idle',
  originPath: '/library',
  speakers: [],
  speakerMap: {},
  renderedContent: '',
};

const normalizeBackendUrlValue = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const deriveMarkdownPath = (mdPath, pdfPath) => {
  const candidate = (mdPath || '').trim();
  if (candidate) return candidate;
  if (pdfPath && /\.pdf$/i.test(pdfPath)) {
    return pdfPath.replace(/\.pdf$/i, '.md');
  }
  return '';
};

const OBJECT_URL_REVOKE_DELAY_MS = 120_000;

const buildFileUrl = (backendUrl, filePath, options = {}) => {
  const normalized = normalizeBackendUrlValue(backendUrl);
  if (!normalized || !filePath) return '';
  const params = new URLSearchParams({ path: filePath });
  const token = typeof options?.token === 'string' ? options.token.trim() : '';
  if (token) {
    params.set('token', token);
  }
  return `${normalized}/api/file?${params.toString()}`;
};

const appendCacheBustingParam = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/[?&]cachebust=/i.test(trimmed)) {
    return trimmed;
  }
  const separator = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${separator}cachebust=${Date.now().toString(36)}`;
};

const normalizeSpeakers = (speakers) =>
  Array.isArray(speakers)
    ? speakers
        .map((label) => (typeof label === 'string' ? label.trim() : ''))
        .filter(Boolean)
    : [];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSpeakerLabelVariants = (label = '') => {
  if (!label || typeof label !== 'string') return [];
  const normalized = label.trim();
  if (!normalized) return [];
  const variants = new Set();
  variants.add(normalized);
  variants.add(normalized.toUpperCase());
  variants.add(normalized.toLowerCase());
  const spaced = normalized.replace(/_/g, ' ');
  if (spaced !== normalized) {
    variants.add(spaced);
    variants.add(spaced.toUpperCase());
    variants.add(spaced.toLowerCase());
    variants.add(spaced.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  const speakerMatch = normalized.match(/speaker[_\s-]*(\d+)/i);
  if (speakerMatch) {
    const rawNumber = speakerMatch[1] || '';
    const parsed = parseInt(rawNumber, 10);
    if (Number.isFinite(parsed)) {
      variants.add(`Speaker ${parsed}`);
      if (parsed === 0 || /^0/.test(rawNumber)) {
        variants.add(`Speaker ${parsed + 1}`);
      }
    }
  }
  return Array.from(variants);
};

const buildSpeakerMap = (speakers, currentMap = {}) => {
  const normalizedSpeakers = normalizeSpeakers(speakers);
  const result = {};
  normalizedSpeakers.forEach((label) => {
    const value =
      currentMap && typeof currentMap[label] === 'string'
        ? currentMap[label]
        : '';
    result[label] = value;
  });
  return result;
};

const applySpeakerMappingToContent = (content, mapping = {}) => {
  if (typeof content !== 'string' || !mapping || typeof mapping !== 'object') {
    return content;
  }
  let result = content;
  Object.entries(mapping).forEach(([label, mappedName]) => {
    if (!label || typeof label !== 'string') return;
    const trimmedName = typeof mappedName === 'string' ? mappedName.trim() : '';
    if (!trimmedName) return;
    const variants = buildSpeakerLabelVariants(label);
    variants.forEach((token) => {
      const quotedPattern = new RegExp(`(['"]?)\s*${escapeRegex(token)}\s*(['"]?)`, 'gi');
      result = result.replace(quotedPattern, (_match, openQuote, closeQuote) => {
        if (openQuote && openQuote === closeQuote) {
          return `${openQuote}${trimmedName}${closeQuote}`;
        }
        return `${trimmedName}`;
      });
    });
    variants.forEach((token) => {
      const colonPattern = new RegExp(`(['"]?)(\\*\\*)?${escapeRegex(token)}(\\*\\*)?(['"]?)(\\s*:)`, 'gi');
      result = result.replace(colonPattern, (_match, openQuote, _leading, _trailing, closeQuote, suffix) => {
        const quote = openQuote && openQuote === closeQuote ? openQuote : '';
        const normalizedSuffix = suffix && suffix.includes(':') ? suffix : ':';
        return `${quote}**${trimmedName}**${quote}${normalizedSuffix}`;
      });
    });
    variants.forEach((token) => {
      const barePattern = new RegExp(`(['"]?)(\\*\\*)?${escapeRegex(token)}(\\*\\*)?(['"]?)`, 'gi');
      result = result.replace(barePattern, (_match, openQuote, _leading, _trailing, closeQuote) => {
        const quote = openQuote && openQuote === closeQuote ? openQuote : '';
        return `${quote}**${trimmedName}**${quote}`;
      });
    });
  });
  return result;
};

const sanitizeSpeakerMapForSubmit = (speakers, mapping = {}) => {
  const normalizedSpeakers = normalizeSpeakers(speakers);
  const sanitized = {};
  normalizedSpeakers.forEach((label) => {
    const value = mapping && typeof mapping[label] === 'string' ? mapping[label].trim() : '';
    if (value) {
      sanitized[label] = value;
    }
  });
  return sanitized;
};

const sanitizeAiProviderSelection = (value) => {
  if (!value || typeof value !== 'object') {
    return { text: '', embedding: '' };
  }
  const normalized = {};
  const textRaw = typeof value.text === 'string' ? value.text : value.aiTextProvider;
  const embeddingRaw = typeof value.embedding === 'string' ? value.embedding : value.aiEmbeddingProvider;
  normalized.text = typeof textRaw === 'string' ? textRaw.trim().toLowerCase() : '';
  normalized.embedding = typeof embeddingRaw === 'string' ? embeddingRaw.trim().toLowerCase() : '';
  return {
    text: normalized.text,
    embedding: normalized.embedding,
  };
};

const readStoredAiProviderSelection = () => {
  if (typeof window === 'undefined') {
    return { text: '', embedding: '' };
  }
  try {
    const raw = localStorage.getItem(AI_PROVIDER_PREFERENCES_KEY);
    if (!raw) {
      return { text: '', embedding: '' };
    }
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeAiProviderSelection(parsed);
    const versionRaw = parsed && typeof parsed.version !== 'undefined' ? Number(parsed.version) : NaN;
    const version = Number.isFinite(versionRaw) ? versionRaw : 1;
    if (version < AI_PROVIDER_PREFERENCES_VERSION) {
      const migrated = { ...sanitized };
      if (migrated.text === 'gemini-pro') {
        migrated.text = '';
      }
      if (migrated.embedding === 'gemini-pro') {
        migrated.embedding = '';
      }
      return migrated;
    }
    return sanitized;
  } catch (error) {
    console.warn('Impossibile recuperare le preferenze AI salvate:', error);
    return { text: '', embedding: '' };
  }
};

const hasNamedSpeakers = (mapping = {}) =>
  Object.values(mapping).some((name) => typeof name === 'string' && name.trim().length > 0);

const normalizeWorkspaceEntry = (workspace) => {
  if (!workspace || typeof workspace !== 'object') {
    return null;
  }
  const statusCatalog = Array.isArray(workspace.statusCatalog)
    ? workspace.statusCatalog.filter(Boolean)
    : [];
  return {
    id: workspace.id || '',
    name: workspace.name || workspace.client || 'Workspace',
    client: workspace.client || workspace.name || '',
    color: workspace.color || '#6366f1',
    projectId: workspace.projectId || '',
    projectName: workspace.projectName || '',
    projectColor: workspace.projectColor || workspace.color || '#6366f1',
    status: workspace.status || '',
    statusCatalog,
    versioningPolicy: workspace.versioningPolicy || null,
  };
};

const normalizeStructureMeta = (structure) => {
  if (!structure || typeof structure !== 'object') {
    return null;
  }
  const score = Number.isFinite(structure.score)
    ? Math.min(100, Math.max(0, Number(structure.score)))
    : null;
  return {
    ok: structure.ok !== false,
    score,
    headings: Array.isArray(structure.headings) ? structure.headings : [],
    missingSections: Array.isArray(structure.missingSections) ? structure.missingSections : [],
    totalRecommended: Number.isFinite(structure.totalRecommended) ? Number(structure.totalRecommended) : null,
    bulletPoints: Number.isFinite(structure.bulletPoints) ? Number(structure.bulletPoints) : null,
    hasCallouts: Boolean(structure.hasCallouts),
    wordCount: Number.isFinite(structure.wordCount) ? Number(structure.wordCount) : null,
    error: structure.error || '',
    promptChecklist: structure.promptChecklist
      ? {
          sections: Array.isArray(structure.promptChecklist.sections)
            ? structure.promptChecklist.sections
            : [],
          missing: Array.isArray(structure.promptChecklist.missing)
            ? structure.promptChecklist.missing
            : [],
          score: Number.isFinite(structure.promptChecklist.score)
            ? Math.min(100, Math.max(0, Number(structure.promptChecklist.score)))
            : null,
          completed: Number.isFinite(structure.promptChecklist.completed)
            ? Number(structure.promptChecklist.completed)
            : null,
          total: Number.isFinite(structure.promptChecklist.total)
            ? Number(structure.promptChecklist.total)
            : null,
        }
      : null,
  };
};

function AppContextComposer({ baseValue, children }) {
  const { flags, hasFlag } = useMode();

  const resetDiarizationPreferenceFromMode = baseValue?.resetDiarizationPreference;

  useEffect(() => {
    if (typeof resetDiarizationPreferenceFromMode === 'function') {
      resetDiarizationPreferenceFromMode();
    }
  }, [resetDiarizationPreferenceFromMode]);

  const contextValue = {
    ...baseValue,
    featureFlags: Array.from(flags),
    modeFlags: Array.from(flags),
    hasFeatureFlag: hasFlag,
    hasModeFlag: hasFlag,
  };

  return <AppProvider value={contextValue}>{children}</AppProvider>;
}

const normalizeWorkspaceProfile = (workspaceId, profile) => {
  if (!profile || typeof profile !== 'object') {
    return null;
  }
  return {
    id: profile.id || '',
    label: profile.label || '',
    slug: profile.slug || '',
    promptId: profile.promptId || '',
    pdfTemplate: profile.pdfTemplate || '',
    pdfTemplateType: profile.pdfTemplateType || profile.templateType || '',
    pdfTemplateCss:
      profile.pdfTemplateCss || profile.pdfTemplateCssFileName || profile.templateCss || '',
    pdfLogoPath: profile.pdfLogoPath || '',
    pdfLogo: profile.pdfLogo || null,
    logoDownloadPath:
      profile.logoDownloadPath || (profile.pdfLogoPath && profile.id ? `/api/workspaces/${workspaceId}/profiles/${profile.id}/logo` : ''),
    updatedAt: profile.updatedAt || Date.now(),
  };
};

const sortWorkspaceProfiles = (profiles = []) => {
  if (!Array.isArray(profiles)) {
    return [];
  }
  return [...profiles].sort((a, b) => {
    const aLabel = (a?.label || a?.id || '').toString();
    const bLabel = (b?.label || b?.id || '').toString();
    return aLabel.localeCompare(bLabel, 'it', { sensitivity: 'base' });
  });
};

const normalizeWorkspaceProfiles = (workspace) => {
  if (!workspace || typeof workspace !== 'object') {
    return [];
  }
  const profiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
  return profiles
    .map((profile) => normalizeWorkspaceProfile(workspace.id || '', profile))
    .filter(Boolean);
};

const buildPromptState = (overrides = {}) => {
  const next = {
    promptId: '',
    focus: '',
    notes: '',
    cueProgress: {},
    cueCardAnswers: {},
    expandPromptDetails: true,
    ...overrides,
  };

  next.promptId = typeof next.promptId === 'string' ? next.promptId : '';
  next.focus = typeof next.focus === 'string' ? next.focus : '';
  next.notes = typeof next.notes === 'string' ? next.notes : '';
  next.cueProgress =
    next.cueProgress && typeof next.cueProgress === 'object' ? next.cueProgress : {};
  next.cueCardAnswers =
    next.cueCardAnswers && typeof next.cueCardAnswers === 'object'
      ? next.cueCardAnswers
      : {};
  next.expandPromptDetails = next.expandPromptDetails === false ? false : true;

  return next;
};

const buildPdfTemplateSelection = (overrides = {}) => {
  const fileName = typeof overrides.fileName === 'string' ? overrides.fileName.trim() : '';
  const type = typeof overrides.type === 'string' ? overrides.type.trim() : '';
  const css = typeof overrides.css === 'string' ? overrides.css.trim() : '';
  return { fileName, type, css };
};

const isFileLike = (value) => {
  if (!value) return false;
  const FileCtor = typeof File !== 'undefined' ? File : null;
  const BlobCtor = typeof Blob !== 'undefined' ? Blob : null;
  if (FileCtor && value instanceof FileCtor) return true;
  if (BlobCtor && value instanceof BlobCtor) return true;
  return false;
};

const isWorkspaceProfileLogoDescriptor = (value) =>
  Boolean(
    value &&
      typeof value === 'object' &&
      value.source === 'workspace-profile' &&
      typeof value.profileId === 'string' &&
      value.profileId &&
      (typeof value.path === 'string' || typeof value.downloadUrl === 'string')
  );

const buildWorkspaceProfileLogoDescriptor = (workspaceId, profile, options = {}) => {
  if (!workspaceId || !profile || typeof profile !== 'object') {
    return null;
  }
  if (!profile.id) {
    return null;
  }
  const rawPath = typeof profile.pdfLogoPath === 'string' ? profile.pdfLogoPath.trim() : '';
  const rawDownload = typeof profile.logoDownloadPath === 'string' ? profile.logoDownloadPath.trim() : '';
  const baseUrl = typeof options.backendUrl === 'string' ? options.backendUrl.trim() : '';

  let downloadUrl = rawDownload;
  if (!downloadUrl && /^https?:\/\//i.test(rawPath)) {
    downloadUrl = rawPath;
  }
  if (downloadUrl && !/^https?:\/\//i.test(downloadUrl) && baseUrl) {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedPath = downloadUrl.replace(/^\/+/, '');
    downloadUrl = `${normalizedBase}/${normalizedPath}`;
  }

  if (!rawPath && !downloadUrl) {
    return null;
  }
  const label =
    (profile.pdfLogo && profile.pdfLogo.originalName) ||
    profile.label ||
    profile.id;
  return {
    source: 'workspace-profile',
    workspaceId,
    profileId: profile.id,
    path: rawPath,
    label: label || profile.id,
    downloadUrl,
  };
};

const sanitizeProjectStatuses = (statuses, fallbackStatuses = []) => {
  const baseList = Array.isArray(statuses)
    ? statuses
    : typeof statuses === 'string'
    ? statuses.split(',')
    : [];
  const normalized = baseList
    .map((status) => String(status || '').trim())
    .filter(Boolean);
  if (normalized.length) {
    return Array.from(new Set(normalized));
  }
  const fallback = Array.isArray(fallbackStatuses)
    ? fallbackStatuses.map((status) => String(status || '').trim()).filter(Boolean)
    : [];
  return Array.from(new Set(fallback));
};

const sanitizeProjectColor = (color, fallbackColor) => {
  const trimmed = typeof color === 'string' ? color.trim() : '';
  if (trimmed) {
    return trimmed;
  }
  const fallback = typeof fallbackColor === 'string' ? fallbackColor.trim() : '';
  return fallback || '#6366f1';
};

const generateProjectId = () => `proj_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const findProjectByName = (projects = [], name) => {
  if (!Array.isArray(projects) || !name) {
    return null;
  }
  const targetName = name.toLowerCase();
  return (
    projects.find((project) => typeof project?.name === 'string' && project.name.toLowerCase() === targetName) || null
  );
};

const appendPdfLogoIfPresent = (formData, logo) => {
  if (!formData || !isFileLike(logo)) {
    return false;
  }
  const fallbackName = 'custom-logo';
  const fileName = typeof logo.name === 'string' && logo.name.trim() ? logo.name : fallbackName;
  formData.append('pdfLogo', logo, fileName);
  return true;
};

const appendWorkspaceProfileDetails = (
  formData,
  { selection, profile, logoDescriptor, backendUrl }
) => {
  if (!formData) {
    return;
  }

  const normalizedBackendUrl = typeof backendUrl === 'string' ? backendUrl.trim() : '';
  const selectionWorkspaceId = typeof selection?.workspaceId === 'string' ? selection.workspaceId.trim() : '';
  const selectionProfileId = typeof selection?.profileId === 'string' ? selection.profileId.trim() : '';

  const descriptorCandidate = isWorkspaceProfileLogoDescriptor(logoDescriptor)
    ? logoDescriptor
    : buildWorkspaceProfileLogoDescriptor(
        selectionWorkspaceId || (typeof profile?.workspaceId === 'string' ? profile.workspaceId.trim() : ''),
        profile,
        { backendUrl: normalizedBackendUrl }
      );

  let descriptor = descriptorCandidate;
  if (
    descriptorCandidate &&
    descriptorCandidate.downloadUrl &&
    normalizedBackendUrl &&
    !/^https?:\/\//i.test(descriptorCandidate.downloadUrl)
  ) {
    const normalizedBase = normalizedBackendUrl.replace(/\/+$/, '');
    const normalizedPath = descriptorCandidate.downloadUrl.replace(/^\/+/, '');
    descriptor = {
      ...descriptorCandidate,
      downloadUrl: `${normalizedBase}/${normalizedPath}`,
    };
  }

  const profileId =
    selectionProfileId ||
    (descriptor && descriptor.profileId) ||
    (typeof profile?.id === 'string' ? profile.id.trim() : '') ||
    '';

  if (!profileId) {
    return;
  }

  if (!formData.has('workspaceProfileId')) {
    formData.append('workspaceProfileId', profileId);
  }

  const workspaceIdValue =
    selectionWorkspaceId ||
    (descriptor && descriptor.workspaceId) ||
    (typeof profile?.workspaceId === 'string' ? profile.workspaceId.trim() : '') ||
    '';

  if (workspaceIdValue && !formData.has('workspaceId')) {
    formData.append('workspaceId', workspaceIdValue);
  }

  const labelCandidate =
    (profile && typeof profile.label === 'string' ? profile.label : '') ||
    (descriptor && descriptor.label) ||
    '';
  if (labelCandidate && !formData.has('workspaceProfileLabel')) {
    formData.append('workspaceProfileLabel', labelCandidate);
  }

  const profileTemplate = String(profile?.pdfTemplate || '').trim();
  if (profileTemplate && !formData.has('workspaceProfileTemplate')) {
    formData.append('workspaceProfileTemplate', profileTemplate);
  }

  const profileTemplateType = String(profile?.pdfTemplateType || '').trim();
  if (profileTemplateType && !formData.has('workspaceProfileTemplateType')) {
    formData.append('workspaceProfileTemplateType', profileTemplateType);
  }

  const profileTemplateCss = String(profile?.pdfTemplateCss || '').trim();
  if (profileTemplateCss && !formData.has('workspaceProfileTemplateCss')) {
    formData.append('workspaceProfileTemplateCss', profileTemplateCss);
  }

  if (descriptor?.path && !formData.has('workspaceProfileLogoPath')) {
    formData.append('workspaceProfileLogoPath', descriptor.path);
  }

  if (descriptor?.label && !formData.has('workspaceProfileLogoLabel')) {
    formData.append('workspaceProfileLogoLabel', descriptor.label);
  }

  if (descriptor?.downloadUrl && !formData.has('workspaceProfileLogoDownloadUrl')) {
    formData.append('workspaceProfileLogoDownloadUrl', descriptor.downloadUrl);
  }
};

const appendPdfTemplateSelection = (formData, selection = {}) => {
  if (!formData) {
    return;
  }

  const template = typeof selection.fileName === 'string' ? selection.fileName.trim() : '';
  if (!template) {
    return;
  }

  if (!formData.has('pdfTemplate')) {
    formData.append('pdfTemplate', template);
  }

  const templateType = typeof selection.type === 'string' ? selection.type.trim() : '';
  if (templateType && !formData.has('pdfTemplateType')) {
    formData.append('pdfTemplateType', templateType);
  }

  const templateCss = typeof selection.css === 'string' ? selection.css.trim() : '';
  if (templateCss && !formData.has('pdfTemplateCss')) {
    formData.append('pdfTemplateCss', templateCss);
  }
};

const resolvePdfLogoLabel = (logo) => {
  if (isWorkspaceProfileLogoDescriptor(logo)) {
    return logo.label || logo.profileId || 'profilo workspace';
  }
  if (typeof logo === 'string') {
    return logo || 'default';
  }
  if (!isFileLike(logo)) {
    return 'default';
  }
  const label = typeof logo.name === 'string' && logo.name.trim() ? logo.name.trim() : '';
  return label || 'custom';
};

const hydrateHistoryEntry = (entry) => {
  if (!entry) return null;
  const pdfPath = entry.pdfPath || '';
  const mdPath = deriveMarkdownPath(entry.mdPath, pdfPath);
  const backendUrl = normalizeBackendUrlValue(entry.backendUrl || '');
  const localPdfPath = typeof entry.localPdfPath === 'string' ? entry.localPdfPath : '';
  const localMdPath = typeof entry.localMdPath === 'string' ? entry.localMdPath : '';
  const pdfUrl =
    entry.pdfUrl && entry.pdfUrl.startsWith('http') && !entry.pdfUrl.includes('/api/file?')
      ? entry.pdfUrl
      : '';
  const mdUrl =
    entry.mdUrl && entry.mdUrl.startsWith('http') && !entry.mdUrl.includes('/api/file?')
      ? entry.mdUrl
      : '';
  const workspace = normalizeWorkspaceEntry(entry.workspace);
  const structure = normalizeStructureMeta(entry.structure);
  const prompt = normalizePromptEntry(entry.prompt);
  const speakers = normalizeSpeakers(entry.speakers);
  const speakerMap = buildSpeakerMap(speakers, entry.speakerMap);
  let refined = null;
  if (entry && typeof entry === 'object' && 'refinedData' in entry) {
    const refinedResult = normalizeRefinedDataForUpload(entry.refinedData);
    if (refinedResult.ok) {
      refined = refinedResult.value;
    }
  }

  return {
    ...entry,
    id: entry.id ?? Date.now(),
    pdfPath,
    mdPath,
    backendUrl,
    localPdfPath,
    localMdPath,
    pdfUrl,
    mdUrl,
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    logs: Array.isArray(entry?.logs) ? entry.logs : [],
    stageEvents: Array.isArray(entry?.stageEvents) ? entry.stageEvents : [],
    workspace,
    structure,
    completenessScore: structure?.score ?? null,
    prompt,
    speakers,
    speakerMap,
    refinedData: refined,
  };
};

const PIPELINE_STAGES = [
  {
    key: 'upload',
    label: 'Upload audio',
    description: 'Caricamento e validazione del file di input.',
    help: 'Verifica che il file audio sia selezionato e che il browser abbia i permessi per l\'upload.',
    icon: Upload,
  },
  {
    key: 'transcode',
    label: 'Transcodifica WAV',
    description: 'Conversione in WAV 16k mono tramite ffmpeg.',
    help: 'Assicurati che ffmpeg sia installato e accessibile nel PATH del backend.',
    icon: Cpu,
  },
  {
    key: 'transcribe',
    label: 'Trascrizione Whisper',
    description: 'Generazione testo con Whisper small in italiano.',
    help: 'Controlla modello Whisper e risorse GPU/CPU sul backend.',
    icon: Waves,
  },
  {
    key: 'markdown',
    label: 'Sintesi Markdown',
    description: 'Creazione note tramite genMD.',
    help: 'Verifica che la funzione genMD sia definita nello shell del backend.',
    icon: FileText,
  },
  {
    key: 'publish',
    label: 'Impaginazione PDF',
    description: 'Impaginazione con PPUBR/pandoc e applicazione logo.',
    help: 'Controlla PPUBR/pandoc e i permessi di scrittura sulla cartella di destinazione.',
    icon: Sparkles,
  },
  {
    key: 'complete',
    label: 'Pipeline conclusa',
    description: 'Conferma finale della pipeline.',
    help: '',
    icon: CheckCircle2,
  },
];

const PIPELINE_STAGE_WEIGHTS = {
  upload: 0.15,
  transcode: 0.2,
  transcribe: 0.25,
  markdown: 0.2,
  publish: 0.15,
  complete: 0.05,
};

const buildInitialPipelineStatus = (initial = 'idle') => {
  return PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = initial;
    return acc;
  }, {});
};

const normalizeStageStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (['completed', 'done', 'success'].includes(value)) return 'done';
  if (['running', 'in_progress', 'started'].includes(value)) return 'running';
  if (['failed', 'error', 'ko', 'failure'].includes(value)) return 'failed';
  if (['pending', 'queued', 'waiting'].includes(value)) return 'pending';
  if (!value) return 'info';
  return value;
};

const updateStatusWithEvent = (prevStatus, event) => {
  if (!event?.stage || !Object.prototype.hasOwnProperty.call(prevStatus, event.stage)) {
    return prevStatus;
  }
  const next = { ...prevStatus };
  const normalized = normalizeStageStatus(event.status);
  if (normalized === 'done') {
    next[event.stage] = 'done';
  } else if (normalized === 'running') {
    next[event.stage] = 'running';
  } else if (normalized === 'failed') {
    next[event.stage] = 'failed';
  } else if (normalized === 'pending') {
    next[event.stage] = 'pending';
  } else if (normalized !== 'info') {
    next[event.stage] = normalized;
  }

  if (normalized === 'running' || normalized === 'done') {
    const stageIndex = PIPELINE_STAGES.findIndex((stage) => stage.key === event.stage);
    if (stageIndex > 0) {
      for (let i = 0; i < stageIndex; i += 1) {
        const prevKey = PIPELINE_STAGES[i].key;
        if (next[prevKey] === 'pending' || next[prevKey] === 'idle' || next[prevKey] === 'running') {
          next[prevKey] = 'done';
        }
      }
    }
  }

  return next;
};

const STAGE_STATUS_LABELS = {
  idle: 'In attesa',
  pending: 'In coda',
  running: 'In corso',
  done: 'Completato',
  failed: 'Errore',
  info: 'Info',
};

const STAGE_STATUS_STYLES = {
  idle: 'border-zinc-800 bg-zinc-950 text-zinc-500',
  pending: 'border-zinc-700 bg-zinc-900 text-zinc-300',
  running: 'border-indigo-500/60 bg-indigo-500/15 text-indigo-100',
  done: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200',
  failed: 'border-rose-500/60 bg-rose-500/10 text-rose-200',
  info: 'border-zinc-700 bg-zinc-900 text-zinc-400',
};

const themes = {
  zinc: {
    bg: "from-zinc-950 via-zinc-900 to-zinc-950",
    card: "bg-zinc-900/50 border-zinc-800",
    input: "bg-zinc-900/60 border-zinc-800",
    input_hover: "hover:bg-zinc-800/60",
    button: "bg-zinc-800 hover:bg-zinc-700 border-zinc-700",
    log: "bg-black/40 border-black/40",
  },
  slate: {
    bg: "from-slate-950 via-slate-900 to-slate-950",
    card: "bg-slate-900/50 border-slate-800",
    input: "bg-slate-900/60 border-slate-800",
    input_hover: "hover:bg-slate-800/60",
    button: "bg-slate-800 hover:bg-slate-700 border-slate-700",
    log: "bg-black/40 border-black/40",
  },
  consulting: {
    bg: "from-gray-900 via-slate-900 to-gray-900",
    card: "bg-white/5 border-white/10",
    input: "bg-white/10 border-white/20",
    input_hover: "hover:bg-white/20",
    button: "bg-slate-700 hover:bg-slate-600 border-slate-600",
    log: "bg-white/5 border-white/10",
  },
  executive: {
    bg: "from-[#030712] via-[#0b1220] to-[#0f172a]",
    card: "bg-slate-900/60 border-emerald-500/20 backdrop-blur",
    input: "bg-slate-900/50 border-emerald-500/30 backdrop-blur",
    input_hover: "hover:bg-slate-900/40",
    button: "bg-emerald-500 hover:bg-emerald-400 text-slate-900 border-emerald-300 font-semibold",
    log: "bg-slate-950/70 border-emerald-500/20",
  },
  boardroom: {
    bg: "from-[#020b1a] via-[#081d36] to-[#103054]",
    card: "border-white/20 bg-gradient-to-br from-white/[0.14] via-white/[0.05] to-transparent backdrop-blur-3xl shadow-[0_45px_120px_-60px_rgba(4,20,44,0.95)]",
    input: "border-white/16 bg-white/[0.05] backdrop-blur-2xl shadow-[0_32px_90px_-58px_rgba(9,33,68,0.85)]",
    input_hover: "hover:border-brand-200/60 hover:bg-white/[0.08]",
    button:
      "bg-gradient-to-r from-brand-400 via-[#1f9bbd] to-[#6b6bff] text-slate-950 border-transparent font-semibold transition-all duration-300 ease-out shadow-[0_32px_90px_-55px_rgba(63,163,255,0.6)] hover:from-brand-500 hover:via-[#1f9bbd] hover:to-[#8f7bff] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-brand-200/60",
    log: "border-white/16 bg-[#071a33]/80 backdrop-blur-2xl",
  },
};

function AppContent(){
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [recording,setRecording]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [level,setLevel]=useState(0);
  const [audioBlob,setAudioBlob]=useState(null);
  const [audioUrl,setAudioUrl]=useState("");
  const [mime,setMime]=useState("");
  const [baseJourneyVisibility, setBaseJourneyVisibility] = useState({
    publish: false,
    pipeline: false,
    refine: false,
  });
  const [destDir,setDestDir]=useState(()=>{
    if(typeof window==='undefined'){
      return DEFAULT_DEST_DIR;
    }
    try{
      const saved=localStorage.getItem(DEST_DIR_STORAGE_KEY);
      if(saved&&saved.trim()){
        return isDestDirPlaceholder(saved)?DEFAULT_DEST_DIR:saved;
      }
    }catch(error){
      console.warn('Impossibile recuperare la cartella di destinazione salvata:',error);
    }
    return DEFAULT_DEST_DIR;
  });
  const [slug,setSlug]=useState("meeting");
  const [secondsCap,setSecondsCap]=useState(0);
  const [backendUrl,setBackendUrl]=useState(DEFAULT_BACKEND_URL);
  const [busy,setBusy]=useState(false);
  const [logs,setLogs]=useState([]);
  const [pdfPath,setPdfPath]=useState("");
  const [mdPath, setMdPath] = useState("");
  const [enableDiarization, setEnableDiarization] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    if (BYPASS_AUTH) {
      setSession({ user: { id: 'test-user' }, access_token: 'test-access-token' });
      setSessionChecked(true);
      return;
    }

    let isMounted = true;

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) {
          return;
        }
        if (error) {
          console.error('Errore recupero sessione Supabase:', error);
        }
        setSession(data?.session ?? null);
      } catch (error) {
        if (isMounted) {
          console.error('Errore recupero sessione Supabase:', error);
        }
      } finally {
        if (isMounted) {
          setSessionChecked(true);
        }
      }
    };

    initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionChecked(true);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);
  const [errorBanner,setErrorBanner]=useState(null);
  const handleLogout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setErrorBanner({ title: 'Logout fallito', details: error.message || 'Errore sconosciuto.' });
      }
    } catch (error) {
      setErrorBanner({ title: 'Logout fallito', details: error.message || 'Errore sconosciuto.' });
    }
  }, [setErrorBanner]);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'boardroom';
    }
    const saved = localStorage.getItem('theme');
    return saved && themes[saved] ? saved : 'boardroom';
  });
  const [showDestDetails,setShowDestDetails]=useState(false);
  useEffect(()=>{
    if(typeof window==='undefined'){
      return;
    }
    try{
      if(isDestDirPlaceholder(destDir)){
        localStorage.removeItem(DEST_DIR_STORAGE_KEY);
      }else{
        localStorage.setItem(DEST_DIR_STORAGE_KEY,destDir);
      }
    }catch(error){
      console.warn('Impossibile salvare la cartella di destinazione:',error);
    }
  },[destDir]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState(null);
  const [showSetupAssistant, setShowSetupAssistant] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('onboardingComplete');
  });
  const openSettingsDrawer = useCallback(
    (section = null, options = {}) => {
      const { showAssistant = false } = options;
      setActiveSettingsSection(section);
      setShowSetupAssistant(showAssistant);
      setSettingsOpen(true);
    },
    [setActiveSettingsSection, setShowSetupAssistant, setSettingsOpen],
  );
  const setAiProviderSelection = useCallback((updater) => {
    setAiProviderSelectionState((prev) => {
      const base = sanitizeAiProviderSelection(prev);
      const next = typeof updater === 'function' ? updater(base) : updater;
      const sanitized = sanitizeAiProviderSelection(next);
      if (sanitized.text === base.text && sanitized.embedding === base.embedding) {
        return prev;
      }
      return sanitized;
    });
  }, []);
  const resetAiProviderSelection = useCallback(() => {
    setAiProviderSelectionState({ text: '', embedding: '' });
  }, []);
  const [customLogo, setCustomLogo] = useState(null);
  const [customPdfLogo, setCustomPdfLogo] = useState(null);
  const [lastMarkdownUpload,setLastMarkdownUpload]=useState(null);
  const [lastTextUpload, setLastTextUpload] = useState(null);
  const [history, setHistory] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => hydrateHistoryEntry(entry)).filter(Boolean);
    } catch {
      return [];
    }
  });
  const [aiProviderSelectionState, setAiProviderSelectionState] = useState(() => readStoredAiProviderSelection());
  const [aiProviderCatalog, setAiProviderCatalog] = useState({
    providers: [],
    defaults: { text: '', embedding: '' },
    loading: false,
    error: '',
    lastFetchedAt: 0,
  });
  const [prompts, setPrompts] = useState([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [pdfTemplates, setPdfTemplates] = useState([]);
  const [pdfTemplatesLoading, setPdfTemplatesLoading] = useState(false);
  const [pdfTemplatesError, setPdfTemplatesError] = useState(null);
  const [pdfTemplateSelection, setPdfTemplateSelection] = useState(() => {
    if (typeof window === 'undefined') {
      return buildPdfTemplateSelection();
    }
    try {
      const raw = localStorage.getItem(PDF_TEMPLATE_SELECTION_KEY);
      if (!raw) {
        return buildPdfTemplateSelection();
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return buildPdfTemplateSelection();
      }
      return buildPdfTemplateSelection(parsed);
    } catch {
      return buildPdfTemplateSelection();
    }
  });
  const [promptState, setPromptState] = useState(() => {
    if (typeof window === 'undefined') {
      return buildPromptState();
    }
    try {
      const raw = localStorage.getItem(PROMPT_SELECTION_KEY);
      if (!raw) {
        return buildPromptState();
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return buildPromptState();
      }
      return buildPromptState({
        promptId: parsed.promptId || '',
        focus: parsed.focus || '',
        notes: parsed.notes || '',
        cueProgress:
          parsed.cueProgress && typeof parsed.cueProgress === 'object'
            ? parsed.cueProgress
            : {},
        cueCardAnswers:
          parsed.cueCardAnswers && typeof parsed.cueCardAnswers === 'object'
            ? parsed.cueCardAnswers
            : {},
        expandPromptDetails: parsed.expandPromptDetails === false ? false : true,
      });
    } catch {
      return buildPromptState();
    }
  });
  const [promptFavorites, setPromptFavorites] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(PROMPT_FAVORITES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(Boolean);
    } catch {
      return [];
    }
  });
  const [refinedData, setRefinedData] = useState(null);

  const setCueCardAnswers = useCallback((valueOrUpdater) => {
    setPromptState((prev) => {
      const currentAnswers =
        prev && typeof prev.cueCardAnswers === 'object' && prev.cueCardAnswers !== null
          ? prev.cueCardAnswers
          : {};
      const draft = typeof valueOrUpdater === 'function'
        ? valueOrUpdater({ ...currentAnswers })
        : valueOrUpdater;
      const sanitized =
        draft && typeof draft === 'object' && draft !== null ? { ...draft } : {};
      const sameKeys = Object.keys(sanitized);
      const unchanged =
        sameKeys.length === Object.keys(currentAnswers).length &&
        sameKeys.every((key) => currentAnswers[key] === sanitized[key]);
      if (unchanged) {
        return prev;
      }
      return { ...prev, cueCardAnswers: sanitized };
    });
  }, []);

  const setPromptFocus = useCallback((value) => {
    const normalized = typeof value === 'string' ? value : '';
    setPromptState((prev) => {
      if (prev.focus === normalized) {
        return prev;
      }
      return { ...prev, focus: normalized };
    });
  }, []);

  const setPromptNotes = useCallback((value) => {
    const normalized = typeof value === 'string' ? value : '';
    setPromptState((prev) => {
      if (prev.notes === normalized) {
        return prev;
      }
      return { ...prev, notes: normalized };
    });
  }, []);

  const setPromptDetailsOpen = useCallback((open) => {
    const normalized = open !== false;
    setPromptState((prev) => {
      if (prev.expandPromptDetails === normalized) {
        return prev;
      }
      return { ...prev, expandPromptDetails: normalized };
    });
  }, []);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSelection, setWorkspaceSelection] = useState(() => {
    if (typeof window === 'undefined') {
      return { workspaceId: '', projectId: '', projectName: '', status: '' };
    }
    try {
      const raw = localStorage.getItem(WORKSPACE_SELECTION_KEY);
      if (!raw) {
        return { workspaceId: '', projectId: '', projectName: '', status: '' };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { workspaceId: '', projectId: '', projectName: '', status: '' };
      }
      return {
        workspaceId: parsed.workspaceId || '',
        projectId: parsed.projectId || '',
        projectName: parsed.projectName || '',
        status: parsed.status || '',
      };
    } catch {
      return { workspaceId: '', projectId: '', projectName: '', status: '' };
    }
  });
  const [workspaceProfileSelection, setWorkspaceProfileSelection] = useState({ workspaceId: '', profileId: '' });
  const [workspaceProfileLocked, setWorkspaceProfileLocked] = useState(false);
  const [savedWorkspaceFilters, setSavedWorkspaceFilters] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(WORKSPACE_FILTERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.map((item, index) => ({
        id: item?.id || now + index,
        name: item?.name || `Filtro ${index + 1}`,
        workspaceId: item?.workspaceId || '',
        projectId: item?.projectId || '',
        projectName: item?.projectName || '',
        status: item?.status || '',
        search: item?.search || '',
      }));
    } catch {
      return [];
    }
  });
  const [navigatorSelection, setNavigatorSelection] = useState(() => ({
    workspaceId: '',
    projectId: '',
    projectName: '',
    status: '',
  }));
  const [projectDraft, setProjectDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [projectCreationMode, setProjectCreationMode] = useState(false);
  const [statusCreationMode, setStatusCreationMode] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(() => buildInitialPipelineStatus('idle'));
  const [activeStageKey, setActiveStageKey] = useState(null);
  const [stageMessages, setStageMessages] = useState({});
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyTab, setHistoryTab] = useState('history');
  const [activePanel, setActivePanel] = useState('doc');
  const [mdEditor, setMdEditor] = useState(() => ({ ...EMPTY_EDITOR_STATE }));
  const {
    secureOK,
    mediaSupported,
    recorderSupported,
    permission,
    setPermission,
    permissionMessage,
    setPermissionMessage,
    lastMicError,
    setLastMicError,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    requestPermission,
  } = useMicrophoneAccess();
  const {
    backendUp,
    setBackendUp,
    checkHealth,
    checkingHealth,
    diagnostics,
    runDiagnostics: runBackendDiagnostics,
    fetchBody,
  } = useBackendDiagnostics(backendUrl, session);
  const [onboardingComplete, setOnboardingComplete] = useState(() => localStorage.getItem('onboardingComplete') === 'true');
  const [onboardingStep, setOnboardingStep] = useState(0);

  const mediaRecorderRef=useRef(null);
  const chunksRef=useRef([]);
  const startAtRef=useRef(null);
  const rafRef=useRef(null);
  const analyserRef=useRef(null);
  const audioCtxRef=useRef(null);
  const sourceRef=useRef(null);
  const streamRef=useRef(null);
  const fileInputRef=useRef(null);
  const markdownInputRef=useRef(null);
  const textInputRef = useRef(null);
  const stageAnimationTimeoutsRef = useRef([]);

  useEffect(()=>{
    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) {
      setCustomLogo(savedLogo);
    }
  }, []);

  useEffect(() => {
    if (customLogo) {
      localStorage.setItem('customLogo', customLogo);
    } else {
      localStorage.removeItem('customLogo');
    }
  }, [customLogo]);

  useEffect(() => {
    if (!themes[theme]) {
      setTheme('boardroom');
      return;
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore persistence errors (quota, privacy modes, ...)
    }
  }, [history]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sanitized = sanitizeAiProviderSelection(aiProviderSelectionState);
      if (!sanitized.text && !sanitized.embedding) {
        localStorage.removeItem(AI_PROVIDER_PREFERENCES_KEY);
      } else {
        localStorage.setItem(
          AI_PROVIDER_PREFERENCES_KEY,
          JSON.stringify({ ...sanitized, version: AI_PROVIDER_PREFERENCES_VERSION })
        );
      }
    } catch (error) {
      console.warn('Impossibile salvare le preferenze AI:', error);
    }
  }, [aiProviderSelectionState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(WORKSPACE_SELECTION_KEY, JSON.stringify(workspaceSelection));
    } catch {
      // Ignore persistence errors
    }
  }, [workspaceSelection]);

  useEffect(() => {
    setAiProviderSelectionState((prev) => {
      const base = sanitizeAiProviderSelection(prev);
      const map = new Map(
        aiProviderCatalog.providers
          .filter((provider) => provider && provider.id)
          .map((provider) => [provider.id, provider])
      );
      let changed = false;
      const next = { ...base };
      if (next.text) {
        const provider = map.get(next.text);
        if (
          !provider ||
          !Array.isArray(provider.capabilities) ||
          !provider.capabilities.includes('text') ||
          !provider.configured
        ) {
          next.text = '';
          changed = true;
        }
      }
      if (next.embedding) {
        const provider = map.get(next.embedding);
        if (
          !provider ||
          !Array.isArray(provider.capabilities) ||
          !provider.capabilities.includes('embedding') ||
          !provider.configured
        ) {
          next.embedding = '';
          changed = true;
        }
      }
      if (!changed) {
        return prev;
      }
      return next;
    });
  }, [aiProviderCatalog.providers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(WORKSPACE_FILTERS_KEY, JSON.stringify(savedWorkspaceFilters));
    } catch {
      // Ignore persistence errors
    }
  }, [savedWorkspaceFilters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PROMPT_SELECTION_KEY, JSON.stringify(promptState));
    } catch {
      // ignore persistence errors
    }
  }, [promptState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (
        !pdfTemplateSelection.fileName &&
        !pdfTemplateSelection.type &&
        !pdfTemplateSelection.css
      ) {
        localStorage.removeItem(PDF_TEMPLATE_SELECTION_KEY);
      } else {
        localStorage.setItem(PDF_TEMPLATE_SELECTION_KEY, JSON.stringify(pdfTemplateSelection));
      }
    } catch {
      // ignore persistence errors
    }
  }, [pdfTemplateSelection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PROMPT_FAVORITES_KEY, JSON.stringify(promptFavorites));
    } catch {
      // ignore persistence errors
    }
  }, [promptFavorites]);

  useEffect(() => {
    if (!workspaceSelection.workspaceId) return;
    const exists = workspaces.some((workspace) => workspace.id === workspaceSelection.workspaceId);
    if (!exists) {
      setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
    }
  }, [workspaces, workspaceSelection.workspaceId]);

  useEffect(() => {
    if (!navigatorSelection.workspaceId || navigatorSelection.workspaceId === '__unassigned__') return;
    const exists = workspaces.some((workspace) => workspace.id === navigatorSelection.workspaceId);
    if (!exists) {
      setNavigatorSelection((prev) => ({ ...prev, workspaceId: '', projectId: '', projectName: '', status: '' }));
    }
  }, [workspaces, navigatorSelection.workspaceId]);

  useEffect(() => {
    if (!promptState.promptId) return;
    const exists = Boolean(findPromptByIdentifier(prompts, promptState.promptId));
    if (!exists) {
      setPromptState(buildPromptState());
    }
  }, [prompts, promptState.promptId]);

  useEffect(() => {
    if (!Array.isArray(prompts) || prompts.length === 0) return;
    setPromptState((prev) => {
      if (prev.promptId) {
        return prev;
      }
      const defaultPrompt = prompts.find((prompt) => {
        const slugMatch = typeof prompt.slug === 'string' && prompt.slug === 'format_base';
        const titleMatch =
          typeof prompt.title === 'string' && prompt.title.trim().toLowerCase() === 'format base';
        return slugMatch || titleMatch;
      });
      if (!defaultPrompt || !defaultPrompt.id) {
        return prev;
      }
      return buildPromptState({
        promptId: defaultPrompt.id,
        focus: prev.focus || '',
        notes: prev.notes || '',
        cueProgress: {},
        cueCardAnswers: {},
        expandPromptDetails: false,
      });
    });
  }, [prompts, setPromptState]);

  useEffect(() => {
    setNavigatorSelection((prev) => {
      if (prev.workspaceId || !workspaceSelection.workspaceId) {
        return prev;
      }
      return {
        workspaceId: workspaceSelection.workspaceId,
        projectId: workspaceSelection.projectId || '',
        projectName: workspaceSelection.projectName || '',
        status: workspaceSelection.status || '',
      };
    });
  }, [workspaceSelection.workspaceId, workspaceSelection.projectId, workspaceSelection.status]);

  const clearStageAnimationTimers = useCallback(() => {
    stageAnimationTimeoutsRef.current.forEach(clearTimeout);
    stageAnimationTimeoutsRef.current = [];
  }, []);

  const resetPipelineProgress = useCallback((isRunning = false) => {
    clearStageAnimationTimers();
    setStageMessages({});
    if (isRunning) {
      const base = buildInitialPipelineStatus('pending');
      const firstStageKey = PIPELINE_STAGES[0]?.key;
      if (firstStageKey) {
        base[firstStageKey] = 'running';
      }
      setPipelineStatus(base);
      setActiveStageKey(PIPELINE_STAGES[0]?.key ?? null);
    } else {
      setPipelineStatus(buildInitialPipelineStatus('idle'));
      setActiveStageKey(null);
    }
  }, [clearStageAnimationTimers]);

  const runEventUpdate = useCallback((event) => {
    if (!event || !event.stage) return;
    const normalizedStatus = normalizeStageStatus(event.status);
    const normalizedEvent = { ...event, status: normalizedStatus };
    setPipelineStatus((prev) => updateStatusWithEvent(prev, normalizedEvent));
    if (normalizedStatus === 'failed') {
      trackEvent('pipeline.stage_failed', {
        stage: event.stage,
        message: typeof event.message === 'string' ? event.message : '',
      });
    }
    let messageToStore = typeof event.message === 'string' ? event.message.trim() : '';
    if (event.stage === 'complete' && normalizedStatus === 'done') {
      const libraryHint = 'Trovi il documento generato nella Library.';
      if (messageToStore) {
        const needsPunctuation = !/[.!?]$/.test(messageToStore);
        messageToStore = `${messageToStore}${needsPunctuation ? '.' : ''}\n${libraryHint}`;
      } else {
        messageToStore = libraryHint;
      }
    }
    if (messageToStore) {
      setStageMessages((prev) => ({ ...prev, [event.stage]: messageToStore }));
    }
    setActiveStageKey((prev) => {
      if (normalizedStatus === 'running') return event.stage;
      if (normalizedStatus === 'failed') return event.stage;
      if (normalizedStatus === 'done') {
        const currentIndex = PIPELINE_STAGES.findIndex((stage) => stage.key === event.stage);
        const nextStage = PIPELINE_STAGES[currentIndex + 1];
        return nextStage ? nextStage.key : null;
      }
      return prev;
    });
  }, [trackEvent]);

  const handlePipelineEvents = useCallback((events = [], options = {}) => {
    const eventArray = Array.isArray(events) ? events : [];
    clearStageAnimationTimers();
    setStageMessages({});

    const initialStatus = options?.initialStatus ?? (eventArray.length ? 'pending' : 'idle');
    const baseStatus = buildInitialPipelineStatus(initialStatus);
    if (eventArray.length && initialStatus !== 'idle') {
      const firstKey = PIPELINE_STAGES[0]?.key;
      if (firstKey) {
        baseStatus[firstKey] = 'running';
      }
    }
    setPipelineStatus(baseStatus);
    setActiveStageKey(eventArray.length ? PIPELINE_STAGES[0]?.key ?? null : null);

    if (!eventArray.length) {
      if (!eventArray.length && initialStatus === 'idle') {
        setActiveStageKey(null);
      }
      return;
    }

    if (options?.autoRevealOnFailure !== false) {
      const hasFailure = eventArray.some((evt) => normalizeStageStatus(evt.status) === 'failed');
      if (hasFailure) {
        setShowRawLogs(true);
      }
    }

    let delay = 0;
    const stepDelay = options?.stepDelayMs ?? 500;
    eventArray.forEach((event) => {
      const normalizedEvent = { ...event, status: normalizeStageStatus(event.status) };
      const runner = () => runEventUpdate(normalizedEvent);
      if (options?.animate === false) {
        runner();
      } else {
        const timeoutId = setTimeout(runner, delay);
        stageAnimationTimeoutsRef.current.push(timeoutId);
        delay += stepDelay;
      }
    });
  }, [clearStageAnimationTimers, runEventUpdate]);

  useEffect(() => {
    return () => {
      clearStageAnimationTimers();
    };
  }, [clearStageAnimationTimers]);

  useEffect(()=>{ checkHealth(); },[backendUrl,busy,checkHealth]);
  useEffect(()=>{ if(!recording) return; const id=setInterval(()=>setElapsed(Math.floor((Date.now()-startAtRef.current)/1000)),333); return()=>clearInterval(id); },[recording]);

  const startAnalyser=async(stream)=>{ if(audioCtxRef.current) return; const C=window.AudioContext||window.webkitAudioContext; if(!C) return; const ctx=new C(); const src=ctx.createMediaStreamSource(stream); const analyser=ctx.createAnalyser(); analyser.fftSize=2048; src.connect(analyser); const data=new Uint8Array(analyser.frequencyBinCount); const loop=()=>{ analyser.getByteTimeDomainData(data); let sum=0; for(let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum+=v*v; } const rms=Math.sqrt(sum/data.length); setLevel(rms); rafRef.current=requestAnimationFrame(loop); }; loop(); analyserRef.current=analyser; audioCtxRef.current=ctx; sourceRef.current=src; };
  const stopAnalyser=()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); try{ sourceRef.current&&sourceRef.current.disconnect(); }catch{} try{ analyserRef.current&&analyserRef.current.disconnect(); }catch{} try{ audioCtxRef.current&&audioCtxRef.current.close(); }catch{} rafRef.current=null; analyserRef.current=null; audioCtxRef.current=null; sourceRef.current=null; setLevel(0); };

  const resetCreationFlowState = useCallback(() => {
    setRefinedData(null);
    setCueCardAnswers({});
    setPromptDetailsOpen(true);
  }, [setCueCardAnswers, setPromptDetailsOpen, setRefinedData]);

  const revealPublishPanel = useCallback(() => {
    setBaseJourneyVisibility((prev) => {
      if (prev.publish) {
        return prev;
      }
      return { ...prev, publish: true };
    });
  }, []);
  const revealPipelinePanel = useCallback(() => {
    setBaseJourneyVisibility((prev) => {
      if (prev.publish && prev.pipeline) {
        return prev;
      }
      return { ...prev, publish: true, pipeline: true };
    });
  }, []);
  const openRefinementPanel = useCallback(() => {
    setBaseJourneyVisibility((prev) => {
      if (prev.refine) {
        return prev;
      }
      return { ...prev, publish: true, pipeline: true, refine: true };
    });
  }, []);
  const closeRefinementPanel = useCallback(() => {
    setBaseJourneyVisibility((prev) => {
      if (!prev.refine) {
        return prev;
      }
      const next = { ...prev, refine: false };
      return next;
    });
  }, []);
  const resetJourneyVisibility = useCallback(() => {
    setBaseJourneyVisibility({ publish: false, pipeline: false, refine: false });
  }, []);

  const startRecording=async()=>{ setLogs([]); setPdfPath(""); setAudioBlob(null); setAudioUrl(""); setPermissionMessage(""); setErrorBanner(null); resetJourneyVisibility(); resetCreationFlowState(); if(!recorderSupported){ setPermissionMessage("MediaRecorder non supportato. Usa il caricamento file."); return;} if(permission!=='granted'){ const ok=await requestPermission(); if(!ok) return;} try{ const constraints=selectedDeviceId?{deviceId:{exact:selectedDeviceId}}:true; const stream=await navigator.mediaDevices.getUserMedia({audio:constraints}); streamRef.current=stream; const mimeType=pickBestMime(); const rec=new MediaRecorder(stream,mimeType?{mimeType}:{}); chunksRef.current=[]; rec.ondataavailable=(e)=>{ if(e.data&&e.data.size) chunksRef.current.push(e.data); }; rec.onstop=()=>{ const blob=new Blob(chunksRef.current,{type:rec.mimeType||mimeType||'audio/webm'}); const url=URL.createObjectURL(blob); setAudioBlob(blob); setAudioUrl(url); setMime(rec.mimeType||mimeType||'audio/webm'); revealPublishPanel(); stopAnalyser(); stream.getTracks().forEach(t=>t.stop()); streamRef.current=null; }; mediaRecorderRef.current=rec; await startAnalyser(stream); rec.start(250); startAtRef.current=Date.now(); setElapsed(0); setRecording(true); }catch(e){ const name=e?.name||""; const msg=e?.message||String(e); setLastMicError({name,message:msg}); if(name==='NotAllowedError'){ setPermission('denied'); setPermissionMessage("Permesso negato. Abilita il microfono dalle impostazioni del sito e riprova."); } else if(name==='NotFoundError'||name==='OverconstrainedError'){ setPermission('denied'); setPermissionMessage("Nessun microfono disponibile o vincoli non validi."); } else if(name==='NotReadableError'){ setPermission('denied'); setPermissionMessage("Il microfono è occupato da un'altra app. Chiudi Zoom/Teams/OBS e riprova."); } else if(!secureOK){ setPermission('denied'); setPermissionMessage("Serve HTTPS o localhost per usare il microfono."); } else { setPermission('unknown'); setPermissionMessage(`Errore: ${msg}`);} } };

  const stopRecording=()=>{ const rec=mediaRecorderRef.current; if(rec&&rec.state!=="inactive") rec.stop(); setRecording(false); };
  useEffect(()=>{ if(recording&&secondsCap&&elapsed>=secondsCap) stopRecording(); },[recording,secondsCap,elapsed]);
  const resetAll=()=>{
    setAudioBlob(null);
    setAudioUrl("");
    setMime("");
    setElapsed(0);
    setLogs([]);
    setPdfPath("");
    setMdPath("");
    setPermissionMessage("");
    setErrorBanner(null);
    resetPipelineProgress(false);
    setShowRawLogs(false);
    setLastMarkdownUpload(null);
    setLastTextUpload(null);
    if(markdownInputRef.current){
      markdownInputRef.current.value="";
    }
    if(textInputRef.current){
      textInputRef.current.value="";
    }
    resetJourneyVisibility();
    setEnableDiarization(false);
    resetCreationFlowState();
  };

  const pushLogs=useCallback((arr)=>{ setLogs(ls=>ls.concat((arr||[]).filter(Boolean))); },[]);
  const canCallAuthenticatedApis = useMemo(
    () => BYPASS_AUTH || !!session?.access_token,
    [session?.access_token],
  );

  const getSessionToken = useCallback(async () => {
    if (session?.access_token) {
      return session.access_token;
    }
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch (error) {
      console.warn('Unable to retrieve session token', error);
      return null;
    }
  }, [session]);

  const refreshSessionIfNeeded = useCallback(async () => {
    if (BYPASS_AUTH) {
      return session;
    }
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('Session refresh failed', error);
        return null;
      }
      if (data?.session) {
        setSession(data.session);
        return data.session;
      }
      if (data?.user) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          setSession(sessionData.session);
          return sessionData.session;
        }
      }
    } catch (error) {
      console.warn('Session refresh threw', error);
    }
    if (session) {
      setSession(null);
    }
    return null;
  }, [session, setSession]);

  const applyAuthToOptions = useCallback(
    async (options = {}, tokenOverride = null) => {
      const token = tokenOverride || session?.access_token || (await getSessionToken());
      if (!token) {
        return { ...options };
      }
      const headers = new Headers(options.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const normalizedOptions = { ...options, headers };
      if (!normalizedOptions.credentials) {
        normalizedOptions.credentials = 'include';
      }
      return normalizedOptions;
    },
    [getSessionToken, session?.access_token]
  );

  const fetchBodyWithAuth = useCallback(
    async (url, options = {}) => {
      let optsWithAuth = await applyAuthToOptions(options);
      let result = await fetchBody(url, optsWithAuth);
      if (result.status === 401 && !BYPASS_AUTH) {
        const refreshed = await refreshSessionIfNeeded();
        if (refreshed?.access_token) {
          optsWithAuth = await applyAuthToOptions(options, refreshed.access_token);
          result = await fetchBody(url, optsWithAuth);
        }
      }
      return result;
    },
    [applyAuthToOptions, fetchBody, refreshSessionIfNeeded]
  );

  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      let optsWithAuth = await applyAuthToOptions(options);
      let response = await fetch(url, optsWithAuth);
      if (response.status === 401 && !BYPASS_AUTH) {
        const refreshed = await refreshSessionIfNeeded();
        if (refreshed?.access_token) {
          optsWithAuth = await applyAuthToOptions(options, refreshed.access_token);
          response = await fetch(url, optsWithAuth);
        }
      }
      return response;
    },
    [applyAuthToOptions, refreshSessionIfNeeded]
  );


  const refreshAiProviderCatalog = useCallback(
    async (options = {}) => {
      const normalized = normalizeBackendUrlValue(options.backendUrlOverride || backendUrl);
      if (!normalized) {
        setAiProviderCatalog((prev) => ({
          ...prev,
          providers: [],
          defaults: { text: '', embedding: '' },
          loading: false,
          error: options?.silent ? prev.error : 'Backend non configurato',
        }));
        return { ok: false, status: 0, message: 'Backend non configurato', skipped: true };
      }

      setAiProviderCatalog((prev) => ({
        ...prev,
        loading: true,
        error: options?.silent ? prev.error : '',
      }));

      try {
        const result = await fetchBodyWithAuth(`${normalized}/api/ai/providers`, { method: 'GET' });
        if (result.ok) {
          const providers = Array.isArray(result.data?.providers) ? result.data.providers : [];
          const defaults = result.data?.defaults || {};
          setAiProviderCatalog({
            providers,
            defaults: {
              text: typeof defaults.text === 'string' ? defaults.text : '',
              embedding: typeof defaults.embedding === 'string' ? defaults.embedding : '',
            },
            loading: false,
            error: '',
            lastFetchedAt: Date.now(),
          });
        } else {
          const message = result.data?.message || result.raw || `HTTP ${result.status || 0}`;
          setAiProviderCatalog((prev) => ({
            ...prev,
            loading: false,
            error: message,
          }));
        }
        return result;
      } catch (error) {
        const message = error?.message || String(error);
        setAiProviderCatalog((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
        return { ok: false, status: 0, message, error };
      }
    },
    [backendUrl, fetchBodyWithAuth],
  );

  useEffect(() => {
    if (!backendUrl || !sessionChecked) return;
    refreshAiProviderCatalog({ silent: true });
  }, [backendUrl, sessionChecked, refreshAiProviderCatalog]);

  const aiProviderMap = useMemo(() => {
    const map = new Map();
    aiProviderCatalog.providers
      .filter((provider) => provider && provider.id)
      .forEach((provider) => {
        map.set(provider.id, provider);
      });
    return map;
  }, [aiProviderCatalog.providers]);

  const aiProvidersEffective = useMemo(() => {
    const defaults = aiProviderCatalog.defaults || { text: '', embedding: '' };
    const resolve = (type) => {
      const selection = aiProviderSelectionState[type] || '';
      if (selection) {
        const provider = aiProviderMap.get(selection);
        if (
          provider &&
          Array.isArray(provider.capabilities) &&
          provider.capabilities.includes(type) &&
          provider.configured
        ) {
          return provider.id;
        }
      }
      const defaultId = defaults[type] || '';
      if (defaultId) {
        const provider = aiProviderMap.get(defaultId);
        if (
          provider &&
          Array.isArray(provider.capabilities) &&
          provider.capabilities.includes(type) &&
          provider.configured
        ) {
          return provider.id;
        }
      }
      const fallback = aiProviderCatalog.providers.find((candidate) =>
        candidate &&
        candidate.configured &&
        Array.isArray(candidate.capabilities) &&
        candidate.capabilities.includes(type)
      );
      return fallback ? fallback.id : '';
    };

    return {
      text: resolve('text'),
      embedding: resolve('embedding'),
    };
  }, [aiProviderCatalog.defaults, aiProviderCatalog.providers, aiProviderMap, aiProviderSelectionState]);
  const aiProviderOverrides = useMemo(
    () => sanitizeAiProviderSelection(aiProviderSelectionState),
    [aiProviderSelectionState],
  );
  const requestSignedFileUrl = useCallback(
    async (backendUrl, filePath) => {
      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        throw new Error('Backend non configurato.');
      }
      const trimmedPath = typeof filePath === 'string' ? filePath.trim() : '';
      if (!trimmedPath) {
        throw new Error('Percorso file non disponibile.');
      }

      const token = (await getSessionToken()) || '';
      const target = buildFileUrl(normalizedBackend, trimmedPath, token ? { token } : undefined);
      const response = await fetchWithAuth(target, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload?.message || `Impossibile generare URL firmato (HTTP ${response.status})`;
        throw new Error(message);
      }

      const signedUrl = typeof payload?.url === 'string' ? payload.url.trim() : '';
      if (!signedUrl) {
        throw new Error('URL firmato non disponibile.');
      }

      return signedUrl;
    },
    [fetchWithAuth, getSessionToken]
  );

  const writeLoadingDocument = useCallback((tab, label) => {
    if (!tab || tab.closed) {
      return;
    }
    try {
      const doc = tab.document;
      if (!doc) return;
      doc.open();
      doc.write(`<!doctype html><html lang="it"><head><meta charset="utf-8" /><title>Caricamento ${label}…</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#111827;color:#e4e4e7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}p{font-size:14px;letter-spacing:0.02em;}</style></head><body><p>Caricamento ${label}…</p></body></html>`);
      doc.close();
    } catch (error) {
      console.warn('Impossibile aggiornare la scheda di caricamento:', error);
    }
  }, []);

  const fetchFileObjectUrl = useCallback(async (url, label) => {
    const requestUrl = appendCacheBustingParam(url);
    if (!requestUrl) {
      throw new Error(`URL ${label} non valido.`);
    }

    const response = await fetch(requestUrl, {
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Impossibile scaricare il ${label} (HTTP ${response.status}).`);
    }

    const blob = await response.blob();
    return { objectUrl: URL.createObjectURL(blob), requestUrl };
  }, []);

  const openSignedFileInNewTab = useCallback(
    async ({ backendUrl, path, label = 'file', directUrl = '' }) => {
      const normalizedPath = typeof path === 'string' ? path.trim() : '';
      if (!normalizedPath) {
        throw new Error(`Percorso ${label} non disponibile.`);
      }

      if (typeof window === 'undefined') {
        throw new Error(`Impossibile aprire il ${label} in questo ambiente.`);
      }

      const newTab = window.open('about:blank', '_blank');
      if (!newTab) {
        throw new Error(`Apertura del ${label} bloccata dal browser. Abilita i pop-up e riprova.`);
      }

      try {
        writeLoadingDocument(newTab, label);

        const normalizedBackend = normalizeBackendUrlValue(backendUrl);
        let resolvedUrl = directUrl || '';

        if (!resolvedUrl) {
          if (!normalizedBackend) {
            throw new Error(`Backend non configurato per aprire il ${label}.`);
          }
          resolvedUrl = await requestSignedFileUrl(normalizedBackend, normalizedPath);
        }
        let objectUrl;
        let requestUrl = appendCacheBustingParam(resolvedUrl);

        try {
          const { objectUrl: fetchedObjectUrl, requestUrl: fetchedRequestUrl } = await fetchFileObjectUrl(
            resolvedUrl,
            label
          );
          objectUrl = fetchedObjectUrl;
          requestUrl = fetchedRequestUrl || requestUrl;
        } catch (downloadError) {
          if (directUrl && requestUrl) {
            newTab.location.href = requestUrl;
            return { url: requestUrl, tab: newTab };
          }
          throw downloadError;
        }

        newTab.location.href = objectUrl;
        setTimeout(() => {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch (revokeError) {
            console.warn('Impossibile rilasciare URL temporaneo:', revokeError);
          }
        }, OBJECT_URL_REVOKE_DELAY_MS);

        return { url: requestUrl || resolvedUrl, tab: newTab };
      } catch (error) {
        if (!newTab.closed) {
          newTab.close();
        }
        throw error;
      }
    },
    [fetchFileObjectUrl, requestSignedFileUrl, writeLoadingDocument]
  );

  const fetchPdfTemplates = useCallback(
    async (options = {}) => {
      const normalized = normalizeBackendUrlValue(options.backendUrlOverride || backendUrl);
      if (!normalized) {
        setPdfTemplates([]);
        if (!options?.silent) {
          setPdfTemplatesError('Backend non configurato');
        } else {
          setPdfTemplatesError(null);
        }
        return { ok: false, status: 0, message: 'Backend non configurato', skipped: true };
      }

      setPdfTemplatesLoading(true);
      if (!options?.silent) {
        setPdfTemplatesError(null);
      }

      try {
        const result = await fetchBodyWithAuth(`${normalized}/api/templates`, { method: 'GET' });
        if (result.ok && Array.isArray(result.data?.templates)) {
          setPdfTemplates(result.data.templates);
          setPdfTemplatesError(null);
        } else {
          const message = result.data?.message || result.raw || 'Impossibile caricare i template.';
          if (!options?.silent) {
            setPdfTemplatesError(message);
            pushLogs([`⚠️ API template: ${message}`]);
          }
        }
        return result;
      } catch (error) {
        const message = error?.message || String(error);
        if (!options?.silent) {
          setPdfTemplatesError(message);
          pushLogs([`⚠️ Errore template: ${message}`]);
        }
        return { ok: false, status: 0, error };
      } finally {
        setPdfTemplatesLoading(false);
      }
    },
    [backendUrl, fetchBodyWithAuth, pushLogs]
  );

  const fetchPrompts = useCallback(
    async (options = {}) => {
      const normalized = normalizeBackendUrlValue(options.backendUrlOverride || backendUrl);
      if (!normalized) {
        if (!options?.silent) {
          setPrompts([]);
        }
        return { ok: false, status: 0, message: 'Backend non configurato', skipped: true };
      }
      if (!options?.silent) {
        setPromptLoading(true);
      }
      try {
        const result = await fetchBodyWithAuth(`${normalized}/api/prompts`, { method: 'GET' });
        if (result.ok) {
          const { prompts: parsedPrompts } = parsePromptsResponse(result.data || {});
          setPrompts(parsedPrompts);
        } else if (!options?.silent) {
          const message = result.data?.message || result.raw || 'Impossibile caricare i prompt.';
          pushLogs([`⚠️ API prompt: ${message}`]);
        }
        return result;
      } catch (error) {
        if (!options?.silent) {
          pushLogs([`⚠️ Errore prompt: ${error?.message || String(error)}`]);
        }
        return { ok: false, status: 0, error };
      } finally {
        if (!options?.silent) {
          setPromptLoading(false);
        }
      }
    },
    [backendUrl, fetchBodyWithAuth, pushLogs]
  );

  useEffect(() => {
    if (!backendUrl || !sessionChecked) {
      setPrompts([]);
      return;
    }
    if (!canCallAuthenticatedApis) {
      return;
    }
    fetchPrompts({ silent: true });
  }, [backendUrl, canCallAuthenticatedApis, fetchPrompts, sessionChecked]);

  useEffect(() => {
    if (!backendUrl || !sessionChecked) {
      setPdfTemplates([]);
      setPdfTemplatesError(null);
      return;
    }
    if (!canCallAuthenticatedApis) {
      return;
    }
    fetchPdfTemplates({ silent: true });
  }, [backendUrl, canCallAuthenticatedApis, fetchPdfTemplates, sessionChecked]);

  const fetchWorkspaces = useCallback(
    async (options = {}) => {
      const normalized = normalizeBackendUrlValue(options.backendUrlOverride || backendUrl);
      if (!normalized) {
        if (!options?.silent) {
          setWorkspaces([]);
        }
        return { ok: false, status: 0, message: 'Backend non configurato', skipped: true };
      }
      setWorkspaceLoading(true);
      try {
        const result = await fetchBodyWithAuth(`${normalized}/api/workspaces`, { method: 'GET' });
        if (result.ok) {
          const { workspaces: parsedWorkspaces } = parseWorkspacesResponse(result.data || {});
          const sanitized = parsedWorkspaces.map((workspace) => ({
            ...workspace,
            profiles: normalizeWorkspaceProfiles(workspace),
          }));
          setWorkspaces(sanitized);
        } else if (!result.ok && !options?.silent) {
          const message = result.data?.message || result.raw || 'Impossibile caricare i workspace.';
          pushLogs([`⚠️ API workspace: ${message}`]);
        }
        return result;
      } catch (error) {
        if (!options?.silent) {
          pushLogs([`⚠️ Errore workspace: ${error?.message || String(error)}`]);
        }
        return { ok: false, status: 0, error };
      } finally {
        setWorkspaceLoading(false);
      }
    },
    [backendUrl, fetchBodyWithAuth, pushLogs]
  );

  useEffect(() => {
    if (!sessionChecked) return;
    if (!canCallAuthenticatedApis) {
      setWorkspaces([]);
      return;
    }
    fetchWorkspaces({ silent: true });
  }, [canCallAuthenticatedApis, fetchWorkspaces, sessionChecked]);

  const handleCreateWorkspace = useCallback(
    async ({ name, client, color, destDir, statuses }) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        const message = 'Configura un backend valido per creare workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const sanitizedName = String(name || '').trim();
      if (!sanitizedName) {
        const message = 'Il nome del workspace è obbligatorio.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const statusArray = Array.isArray(statuses)
        ? statuses.filter(Boolean)
        : typeof statuses === 'string'
        ? statuses
            .split(',')
            .map((chunk) => chunk.trim())
            .filter(Boolean)
        : [];
      const normalizedDestDir = sanitizeDestDirForRequest(destDir);
      try {
        const response = await fetchWithAuth(`${normalized}/api/workspaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sanitizedName,
            client: String(client || sanitizedName).trim(),
            color: color || '#6366f1',
            destDir: normalizedDestDir,
            defaultStatuses: statusArray.length ? statusArray : undefined,
          }),
        });
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          const message = payload?.message || `Creazione workspace fallita (HTTP ${response.status})`;
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }
        const { workspace: parsedWorkspace } = parseWorkspaceResponse(payload);
        if (parsedWorkspace) {
          const normalizedWorkspace = {
            ...parsedWorkspace,
            profiles: normalizeWorkspaceProfiles(parsedWorkspace),
          };
          setWorkspaces((prev) => [...prev, normalizedWorkspace]);
          pushLogs([`✅ Workspace creato: ${normalizedWorkspace.name}`]);
          if (!workspaceSelection.workspaceId && normalizedWorkspace.id) {
            setWorkspaceSelection({
              workspaceId: normalizedWorkspace.id,
              projectId: '',
              projectName: '',
              status: '',
            });
          }
          return { ok: true, workspace: normalizedWorkspace };
        }
        const message = 'Il workspace restituito dal backend non è valido.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      } catch (error) {
        const message = error?.message || 'Errore creazione workspace';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchWithAuth, pushLogs, workspaceSelection.workspaceId]
  );

  const handleUpdateWorkspace = useCallback(
    async (workspaceId, updates = {}) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        const message = 'Configura un backend valido per aggiornare i workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const trimmedId = String(workspaceId || '').trim();
      if (!trimmedId) {
        const message = 'Workspace non valido.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }

      const payload = {};
      if (typeof updates.name === 'string') {
        payload.name = updates.name.trim();
      }
      if (typeof updates.client === 'string') {
        payload.client = updates.client.trim();
      }
      if (typeof updates.color === 'string' && updates.color.trim()) {
        payload.color = updates.color.trim();
      }
      if (Array.isArray(updates.defaultStatuses)) {
        payload.defaultStatuses = updates.defaultStatuses;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'destDir')) {
        payload.destDir = sanitizeDestDirForRequest(updates.destDir);
      }

      if (!Object.keys(payload).length) {
        return { ok: true, skipped: true };
      }

      try {
        const response = await fetchWithAuth(`${normalized}/api/workspaces/${trimmedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        let body = {};
        try {
          body = await response.json();
        } catch {
          body = {};
        }
        if (!response.ok) {
          const message = body?.message || `Aggiornamento workspace fallito (HTTP ${response.status})`;
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }
        const { workspace: parsedWorkspace } = parseWorkspaceResponse(body);
        if (parsedWorkspace) {
          const normalizedWorkspace = {
            ...parsedWorkspace,
            profiles: normalizeWorkspaceProfiles(parsedWorkspace),
          };
          setWorkspaces((prev) =>
            prev.map((ws) => (ws.id === trimmedId ? normalizedWorkspace : ws))
          );
          pushLogs([`✅ Workspace aggiornato: ${normalizedWorkspace.name || trimmedId}`]);
          return { ok: true, workspace: normalizedWorkspace };
        }
        const message = 'Il workspace aggiornato non è valido.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      } catch (error) {
        const message = error?.message || 'Errore aggiornamento workspace';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchWithAuth, pushLogs]
  );

  const handleDeleteWorkspace = useCallback(
    async (workspaceId) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        const message = 'Configura un backend valido per eliminare i workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const trimmedId = String(workspaceId || '').trim();
      if (!trimmedId) {
        const message = 'Workspace non valido.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      try {
        const response = await fetchWithAuth(`${normalized}/api/workspaces/${trimmedId}`, {
          method: 'DELETE',
        });
        let body = {};
        try {
          body = await response.json();
        } catch {
          body = {};
        }
        if (!response.ok) {
          const message = body?.message || `Eliminazione workspace fallita (HTTP ${response.status})`;
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }
        setWorkspaces((prev) => prev.filter((ws) => ws.id !== trimmedId));
        if (workspaceSelection.workspaceId === trimmedId) {
          setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
          setWorkspaceProfileSelection({ workspaceId: '', profileId: '' });
          setWorkspaceProfileLocked(false);
        }
        pushLogs([`✅ Workspace eliminato: ${trimmedId}`]);
        return { ok: true };
      } catch (error) {
        const message = error?.message || 'Errore eliminazione workspace';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [
      backendUrl,
      fetchWithAuth,
      pushLogs,
      workspaceSelection.workspaceId,
      setWorkspaceProfileSelection,
      setWorkspaceProfileLocked,
    ]
  );

  const ensureWorkspaceForProjects = useCallback(
    async (workspaceId) => {
      const trimmedId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      if (!trimmedId) {
        return null;
      }
      const existingWorkspace = workspaces.find((ws) => ws.id === trimmedId);
      if (existingWorkspace) {
        return existingWorkspace;
      }
      const refreshed = await fetchWorkspaces({ silent: true });
      if (refreshed?.ok && refreshed.data) {
        const { workspaces: parsedWorkspaces } = parseWorkspacesResponse(refreshed.data || {});
        if (Array.isArray(parsedWorkspaces)) {
          const normalized = parsedWorkspaces.map((workspace) => ({
            ...workspace,
            profiles: normalizeWorkspaceProfiles(workspace),
          }));
          return normalized.find((workspace) => workspace.id === trimmedId) || null;
        }
      }
      return null;
    },
    [workspaces, fetchWorkspaces]
  );

  const createWorkspaceProject = useCallback(
    async (workspaceId, project) => {
      const targetWorkspaceId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      if (!targetWorkspaceId) {
        const message = 'Workspace non valido per creare il progetto.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        const message = 'Configura un backend valido per creare progetti.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const targetWorkspace = await ensureWorkspaceForProjects(targetWorkspaceId);
      if (!targetWorkspace) {
        const message = 'Workspace non disponibile sul backend.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const trimmedName = String(project?.name || '').trim();
      if (!trimmedName) {
        const message = 'Il nome del progetto è obbligatorio.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const existingProjects = Array.isArray(targetWorkspace.projects)
        ? targetWorkspace.projects.map((proj) => ({ ...proj }))
        : [];
      if (findProjectByName(existingProjects, trimmedName)) {
        const message = 'Esiste già un progetto con questo nome.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const fallbackStatuses =
        Array.isArray(targetWorkspace.defaultStatuses) && targetWorkspace.defaultStatuses.length
          ? targetWorkspace.defaultStatuses
          : DEFAULT_WORKSPACE_STATUSES;
      const resolvedStatuses = sanitizeProjectStatuses(project?.statuses, fallbackStatuses);
      const color = sanitizeProjectColor(project?.color, targetWorkspace.color);
      const destDir = sanitizeDestDirForRequest(project?.destDir);
      const projectId =
        typeof project?.id === 'string' && project.id.trim() ? project.id.trim() : generateProjectId();
      const nextProject = {
        id: projectId,
        name: trimmedName,
        color,
        destDir,
        statuses: resolvedStatuses.length ? resolvedStatuses : [...fallbackStatuses],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const nextProjectsPayload = [...existingProjects, nextProject];
      try {
        const response = await fetchWithAuth(`${normalizedBackend}/api/workspaces/${targetWorkspaceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects: nextProjectsPayload }),
        });
        let body = {};
        try {
          body = await response.json();
        } catch {
          body = {};
        }
        if (!response.ok) {
          const message = body?.message || `Aggiornamento workspace fallito (HTTP ${response.status})`;
          const details = Array.isArray(body?.details) ? body.details : [];
          pushLogs([`❌ ${message}`].concat(details));
          return { ok: false, message, details };
        }
        const { workspace: parsedWorkspace } = parseWorkspaceResponse(body);
        if (parsedWorkspace) {
          const normalizedWorkspace = {
            ...parsedWorkspace,
            profiles: normalizeWorkspaceProfiles(parsedWorkspace),
          };
          setWorkspaces((prev) =>
            prev.map((workspace) => (workspace.id === targetWorkspaceId ? normalizedWorkspace : workspace))
          );
          const createdProject =
            normalizedWorkspace.projects?.find((proj) => proj.id === nextProject.id) ||
            findProjectByName(normalizedWorkspace.projects, trimmedName) ||
            null;
          pushLogs([`✅ Progetto creato: ${createdProject?.name || trimmedName}`]);
          return {
            ok: true,
            project: createdProject || nextProject,
            projects: normalizedWorkspace.projects || [],
            workspace: normalizedWorkspace,
          };
        }
        pushLogs([`✅ Progetto creato: ${trimmedName}`]);
        return { ok: true, project: nextProject, projects: nextProjectsPayload };
      } catch (error) {
        const message = error?.message || 'Errore durante la creazione del progetto';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchWithAuth, pushLogs, ensureWorkspaceForProjects, setWorkspaces]
  );

  const updateWorkspaceProject = useCallback(
    async (workspaceId, projectId, updates = {}) => {
      const targetWorkspaceId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      if (!targetWorkspaceId) {
        const message = "Workspace non valido per l'aggiornamento del progetto.";
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        const message = 'Configura un backend valido per aggiornare i progetti.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const targetWorkspace = await ensureWorkspaceForProjects(targetWorkspaceId);
      if (!targetWorkspace) {
        const message = 'Workspace non disponibile sul backend.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const trimmedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
      if (!trimmedProjectId) {
        const message = 'Progetto non valido.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const baseProjects = Array.isArray(targetWorkspace.projects)
        ? targetWorkspace.projects.map((proj) => ({ ...proj }))
        : [];
      let existingProject =
        baseProjects.find((proj) => proj.id === trimmedProjectId) ||
        findProjectByName(baseProjects, trimmedProjectId) ||
        null;
      if (!existingProject) {
        const message = 'Progetto non trovato nel workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const nextName =
        typeof updates?.name === 'string' && updates.name.trim() ? updates.name.trim() : existingProject.name || '';
      if (!nextName) {
        const message = 'Il nome del progetto è obbligatorio.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const duplicate = baseProjects.find(
        (proj) =>
          proj.id !== existingProject.id &&
          typeof proj.name === 'string' &&
          proj.name.toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) {
        const message = 'Esiste già un progetto con questo nome.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const fallbackStatuses =
        Array.isArray(targetWorkspace.defaultStatuses) && targetWorkspace.defaultStatuses.length
          ? targetWorkspace.defaultStatuses
          : DEFAULT_WORKSPACE_STATUSES;
      const statusesInput =
        updates.statuses !== undefined ? updates.statuses : existingProject.statuses;
      const normalizedStatuses = sanitizeProjectStatuses(statusesInput, fallbackStatuses);
      const resolvedStatuses = normalizedStatuses.length ? normalizedStatuses : [...fallbackStatuses];
      const nextColor = sanitizeProjectColor(
        updates.color !== undefined ? updates.color : existingProject.color,
        targetWorkspace.color || existingProject.color
      );
      const destDirInput = Object.prototype.hasOwnProperty.call(updates, 'destDir')
        ? updates.destDir
        : existingProject.destDir;
      const nextDestDir = sanitizeDestDirForRequest(destDirInput);
      const nextProjectsPayload = baseProjects.map((proj) => {
        if (proj.id !== existingProject.id) {
          return { ...proj };
        }
        return {
          ...proj,
          name: nextName,
          color: nextColor,
          destDir: nextDestDir,
          statuses: resolvedStatuses,
          updatedAt: Date.now(),
        };
      });
      try {
        const response = await fetchWithAuth(`${normalizedBackend}/api/workspaces/${targetWorkspaceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects: nextProjectsPayload }),
        });
        let body = {};
        try {
          body = await response.json();
        } catch {
          body = {};
        }
        if (!response.ok) {
          const message = body?.message || `Aggiornamento workspace fallito (HTTP ${response.status})`;
          const details = Array.isArray(body?.details) ? body.details : [];
          pushLogs([`❌ ${message}`].concat(details));
          return { ok: false, message, details };
        }
        const { workspace: parsedWorkspace } = parseWorkspaceResponse(body);
        if (parsedWorkspace) {
          const normalizedWorkspace = {
            ...parsedWorkspace,
            profiles: normalizeWorkspaceProfiles(parsedWorkspace),
          };
          setWorkspaces((prev) =>
            prev.map((workspace) => (workspace.id === targetWorkspaceId ? normalizedWorkspace : workspace))
          );
          const updatedProject =
            normalizedWorkspace.projects?.find((proj) => proj.id === existingProject.id) ||
            findProjectByName(normalizedWorkspace.projects, nextName) ||
            null;
          pushLogs([`✅ Progetto aggiornato: ${updatedProject?.name || nextName}`]);
          return {
            ok: true,
            project: updatedProject || {
              ...existingProject,
              name: nextName,
              color: nextColor,
              statuses: resolvedStatuses,
            },
            projects: normalizedWorkspace.projects || [],
            workspace: normalizedWorkspace,
          };
        }
        pushLogs([`✅ Progetto aggiornato: ${nextName}`]);
        return {
          ok: true,
          project: {
            ...existingProject,
            name: nextName,
            color: nextColor,
            destDir: nextDestDir,
            statuses: resolvedStatuses,
          },
          projects: nextProjectsPayload,
        };
      } catch (error) {
        const message = error?.message || "Errore durante l'aggiornamento del progetto";
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchWithAuth, pushLogs, ensureWorkspaceForProjects, setWorkspaces]
  );

  const deleteWorkspaceProject = useCallback(
    async (workspaceId, projectId) => {
      const targetWorkspaceId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      if (!targetWorkspaceId) {
        const message = 'Workspace non valido per la rimozione del progetto.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        const message = 'Configura un backend valido per rimuovere i progetti.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const targetWorkspace = await ensureWorkspaceForProjects(targetWorkspaceId);
      if (!targetWorkspace) {
        const message = 'Workspace non disponibile sul backend.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const trimmedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
      if (!trimmedProjectId) {
        const message = 'Progetto non valido.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const baseProjects = Array.isArray(targetWorkspace.projects)
        ? targetWorkspace.projects.map((proj) => ({ ...proj }))
        : [];
      const projectToRemove =
        baseProjects.find((proj) => proj.id === trimmedProjectId) ||
        findProjectByName(baseProjects, trimmedProjectId) ||
        null;
      if (!projectToRemove) {
        const message = 'Progetto non trovato nel workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
      const nextProjectsPayload = baseProjects.filter((proj) => proj.id !== projectToRemove.id);
      try {
        const response = await fetchWithAuth(`${normalizedBackend}/api/workspaces/${targetWorkspaceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects: nextProjectsPayload }),
        });
        let body = {};
        try {
          body = await response.json();
        } catch {
          body = {};
        }
        if (!response.ok) {
          const message = body?.message || `Aggiornamento workspace fallito (HTTP ${response.status})`;
          const details = Array.isArray(body?.details) ? body.details : [];
          pushLogs([`❌ ${message}`].concat(details));
          return { ok: false, message, details };
        }
        const { workspace: parsedWorkspace } = parseWorkspaceResponse(body);
        if (parsedWorkspace) {
          const normalizedWorkspace = {
            ...parsedWorkspace,
            profiles: normalizeWorkspaceProfiles(parsedWorkspace),
          };
          setWorkspaces((prev) =>
            prev.map((workspace) => (workspace.id === targetWorkspaceId ? normalizedWorkspace : workspace))
          );
          pushLogs([`🗑️ Progetto eliminato: ${projectToRemove.name || projectToRemove.id}`]);
          return {
            ok: true,
            projects: normalizedWorkspace.projects || [],
            workspace: normalizedWorkspace,
          };
        }
        pushLogs([`🗑️ Progetto eliminato: ${projectToRemove.name || projectToRemove.id}`]);
        return { ok: true, projects: nextProjectsPayload };
      } catch (error) {
        const message = error?.message || 'Errore durante la rimozione del progetto';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchWithAuth, pushLogs, ensureWorkspaceForProjects, setWorkspaces]
  );

  const handleEnsureWorkspaceProject = useCallback(
    async (workspaceId, { projectId, projectName, status } = {}) => {
      const targetWorkspaceId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      if (!targetWorkspaceId) {
        return { ok: false, message: 'Workspace mancante' };
      }
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        const message = 'Configura un backend valido per aggiornare i workspace.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }

      const targetWorkspace = await ensureWorkspaceForProjects(targetWorkspaceId);
      if (!targetWorkspace) {
        const message = 'Workspace non trovato sul backend.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      const projectNameTrimmed = String(projectName || '').trim();
      const projectIdTrimmed = String(projectId || '').trim();
      const statusTrimmed = String(status || '').trim();

      if (!projectNameTrimmed && !projectIdTrimmed && !statusTrimmed) {
        return { ok: true, workspace: targetWorkspace, updated: false };
      }

      const projects = Array.isArray(targetWorkspace.projects)
        ? targetWorkspace.projects.map((proj) => ({
            ...proj,
            statuses: Array.isArray(proj.statuses) ? [...proj.statuses] : [],
          }))
        : [];

      const fallbackStatuses =
        Array.isArray(targetWorkspace.defaultStatuses) && targetWorkspace.defaultStatuses.length
          ? targetWorkspace.defaultStatuses
          : DEFAULT_WORKSPACE_STATUSES;

      let existingProject = null;
      if (projectIdTrimmed) {
        existingProject = projects.find((proj) => proj.id === projectIdTrimmed) || null;
      }
      if (!existingProject && projectNameTrimmed) {
        existingProject = findProjectByName(projects, projectNameTrimmed);
      }

      let changed = false;
      if (!existingProject && projectNameTrimmed) {
        const newProject = {
          id: projectIdTrimmed || generateProjectId(),
          name: projectNameTrimmed,
          color: sanitizeProjectColor(targetWorkspace.color, targetWorkspace.color),
          destDir: sanitizeDestDirForRequest(targetWorkspace.destDir || ''),
          statuses: statusTrimmed
            ? sanitizeProjectStatuses([statusTrimmed], fallbackStatuses)
            : [...fallbackStatuses],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        projects.push(newProject);
        existingProject = newProject;
        changed = true;
      } else if (existingProject && statusTrimmed && !existingProject.statuses.includes(statusTrimmed)) {
        existingProject.statuses = sanitizeProjectStatuses(
          [...existingProject.statuses, statusTrimmed],
          fallbackStatuses
        );
        existingProject.updatedAt = Date.now();
        changed = true;
      }

      if (!changed) {
        return { ok: true, workspace: targetWorkspace, updated: false, project: existingProject };
      }

      try {
        const response = await fetchWithAuth(`${normalized}/api/workspaces/${targetWorkspaceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects }),
        });
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          const message = payload?.message || `Aggiornamento workspace fallito (HTTP ${response.status})`;
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }
        const { workspace: parsedWorkspace } = parseWorkspaceResponse(payload);
        if (parsedWorkspace) {
          const normalizedWorkspace = {
            ...parsedWorkspace,
            profiles: normalizeWorkspaceProfiles(parsedWorkspace),
          };
          setWorkspaces((prev) =>
            prev.map((ws) => (ws.id === targetWorkspaceId ? normalizedWorkspace : ws))
          );
          const resolvedProject = existingProject
            ? normalizedWorkspace.projects?.find((proj) => proj.id === existingProject.id) || existingProject
            : null;
          return { ok: true, workspace: normalizedWorkspace, updated: true, project: resolvedProject };
        }
        return { ok: true, workspace: targetWorkspace, updated: true, project: existingProject };
      } catch (error) {
        const message = error?.message || 'Errore aggiornamento workspace';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [
      backendUrl,
      fetchWithAuth,
      ensureWorkspaceForProjects,
      pushLogs,
      setWorkspaces,
    ]
  );

  const handleAssignEntryWorkspace = useCallback(
    async (entry, assignment, options = {}) => {
      if (!entry) return;
      setHistory((prev) =>
        prev.map((item) => (item.id === entry.id ? hydrateHistoryEntry({ ...item, workspace: assignment }) : item))
      );
      if (options.ensureMetadata && assignment?.id) {
        await handleEnsureWorkspaceProject(assignment.id, {
          projectId: assignment.projectId,
          projectName: assignment.projectName,
          status: assignment.status,
        });
        fetchWorkspaces({ silent: true });
      }
    },
    [handleEnsureWorkspaceProject, fetchWorkspaces]
  );

  const handleLibraryWorkspaceSelection = useCallback(
    (assignment = {}) => {
      const nextSelection = {
        workspaceId: assignment?.workspaceId || assignment?.id || '',
        projectId: assignment?.projectId || '',
        projectName: assignment?.projectName || '',
        status: assignment?.status || '',
      };
      setNavigatorSelection((prev) => {
        if (
          prev.workspaceId === nextSelection.workspaceId &&
          prev.projectId === nextSelection.projectId &&
          (prev.projectName || '') === (nextSelection.projectName || '') &&
          (prev.status || '') === (nextSelection.status || '')
        ) {
          return prev;
        }
        return nextSelection;
      });
    },
    [setNavigatorSelection]
  );

  const fetchEntryPreview = useCallback(
    async (entry) => {
      if (!entry) {
        return { ok: false, message: 'Nessun documento selezionato.' };
      }
      const mdPathResolved = deriveMarkdownPath(entry?.mdPath, entry?.pdfPath);
      if (!mdPathResolved) {
        return { ok: false, message: 'Markdown non disponibile per questa sessione.' };
      }
      const backendTarget = normalizeBackendUrlValue(entry?.backendUrl || backendUrl);
      if (!backendTarget) {
        return { ok: false, message: 'Backend non configurato per il documento selezionato.' };
      }
      try {
        const response = await fetchWithAuth(
          `${backendTarget}/api/markdown?path=${encodeURIComponent(mdPathResolved)}`,
          { method: 'GET' }
        );
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (!response.ok) {
          const message = payload?.message || `Anteprima Markdown non disponibile (HTTP ${response.status})`;
          return { ok: false, message };
        }
        const markdown = typeof payload?.content === 'string' ? payload.content : '';
        const token = await getSessionToken();
        return {
          ok: true,
          markdown,
          pdfUrl: buildFileUrl(backendTarget, entry.pdfPath, token ? { token } : undefined),
          mdUrl: buildFileUrl(backendTarget, mdPathResolved, token ? { token } : undefined),
        };
      } catch (error) {
        return { ok: false, message: error?.message || 'Errore durante il recupero dell\'anteprima.' };
      }
    },
    [backendUrl, fetchWithAuth, getSessionToken]
  );

  const fetchEntryPreAnalysis = useCallback(
    async (entry, options = {}) => {
      if (!entry) {
        return { ok: false, message: 'Nessun documento selezionato.' };
      }

      const backendTarget = normalizeBackendUrlValue(entry?.backendUrl || backendUrl);
      if (!backendTarget) {
        return { ok: false, message: 'Backend non configurato per il documento selezionato.' };
      }

      const payload = buildPreAnalyzeRequest(entry, options?.overrides || {});
      if (!payload || Object.keys(payload).length === 0) {
        return { ok: false, message: 'Dati insufficienti per eseguire la pre-analisi.' };
      }

      try {
        const result = await postPreAnalyze({
          backendUrl: backendTarget,
          fetcher: (url, fetchOptions) => fetchBodyWithAuth(url, fetchOptions),
          payload,
        });

        if (result.ok) {
          if (result.message) {
            pushLogs([`ℹ️ Pre-analisi: ${result.message}`]);
          }
          return { ok: true, data: result.data, raw: result.raw };
        }

        if (!result.skipped && result.message) {
          pushLogs([`⚠️ Pre-analisi: ${result.message}`]);
        }

        return { ok: false, message: result.message || 'Pre-analisi non disponibile.' };
      } catch (error) {
        const message = error?.message || 'Errore durante la pre-analisi.';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchBodyWithAuth, pushLogs]
  );

  const handleSaveWorkspaceFilter = useCallback(
    (filter) => {
      const name = filter?.name?.trim() || `Filtro ${savedWorkspaceFilters.length + 1}`;
      const entry = {
        id: Date.now(),
        name,
        workspaceId: filter?.workspaceId || '',
        projectId: filter?.projectId || '',
        projectName: filter?.projectName || '',
        status: filter?.status || '',
        search: filter?.search || '',
      };
      setSavedWorkspaceFilters((prev) => [...prev, entry]);
      pushLogs([`✅ Filtro salvato: ${name}`]);
    },
    [savedWorkspaceFilters.length, pushLogs]
  );

  const handleDeleteWorkspaceFilter = useCallback((id) => {
    setSavedWorkspaceFilters((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleApplyWorkspaceFilter = useCallback((filter) => {
    if (!filter) return;
    setNavigatorSelection({
      workspaceId: filter.workspaceId || '',
      projectId: filter.projectId || '',
      projectName: filter.projectName || '',
      status: filter.status || '',
    });
    setHistoryFilter(filter.search || '');
  }, []);

  const handleRefreshWorkspaces = useCallback(() => {
    fetchWorkspaces({ silent: false });
  }, [fetchWorkspaces]);

  const refreshPdfTemplates = useCallback(() => {
    fetchPdfTemplates({ silent: false });
  }, [fetchPdfTemplates]);

  const createWorkspaceProfile = useCallback(
    async (workspaceId, profile) => {
      const targetWorkspaceId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      if (!targetWorkspaceId) {
        const message = 'Seleziona un workspace valido prima di creare un profilo.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        const message = 'Configura un backend valido per creare profili.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      try {
        const formData = new FormData();
        formData.set('label', String(profile?.label || '').trim());
        formData.set('slug', String(profile?.slug || '').trim());
        formData.set('promptId', String(profile?.promptId || '').trim());
        formData.set('pdfTemplate', String(profile?.pdfTemplate || '').trim());
        formData.set('pdfTemplateType', String(profile?.pdfTemplateType || '').trim());
        formData.set('pdfTemplateCss', String(profile?.pdfTemplateCss || '').trim());
        if (profile?.pdfLogo instanceof File || profile?.pdfLogo instanceof Blob) {
          const file = profile.pdfLogo;
          const fileName = typeof file.name === 'string' && file.name ? file.name : 'logo.pdf';
          formData.set('pdfLogo', file, fileName);
        }

        const response = await fetchWithAuth(
          `${normalizedBackend}/api/workspaces/${targetWorkspaceId}/profiles`,
          {
            method: 'POST',
            body: formData,
          }
        );

        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }

        if (!response.ok) {
          const message = payload?.message || `Creazione profilo fallita (HTTP ${response.status})`;
          const details = Array.isArray(payload?.details) ? payload.details : [];
          pushLogs([`❌ ${message}`].concat(details));
          return { ok: false, message, details };
        }

        const normalizedProfile = normalizeWorkspaceProfile(targetWorkspaceId, payload?.profile);
        if (!normalizedProfile) {
          const message = 'Il profilo restituito dal backend non è valido.';
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }

        setWorkspaces((prev) =>
          prev.map((workspace) => {
            if (workspace.id !== targetWorkspaceId) {
              return workspace;
            }
            const baseProfiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
            const withoutProfile = baseProfiles.filter((item) => item.id !== normalizedProfile.id);
            return {
              ...workspace,
              profiles: sortWorkspaceProfiles([...withoutProfile, normalizedProfile]),
            };
          })
        );

        pushLogs([`✅ Profilo creato: ${normalizedProfile.label}`]);
        return { ok: true, profile: normalizedProfile };
      } catch (error) {
        const message = error?.message || 'Errore durante la creazione del profilo';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchWithAuth, pushLogs]
  );

  const updateWorkspaceProfile = useCallback(
    async (workspaceId, profileId, profile) => {
      const targetWorkspaceId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      const targetProfileId = typeof profileId === 'string' ? profileId.trim() : '';
      if (!targetWorkspaceId || !targetProfileId) {
        const message = 'Workspace o profilo non valido per l\'aggiornamento.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        const message = 'Configura un backend valido per aggiornare i profili.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      try {
        const formData = new FormData();
        formData.set('label', String(profile?.label || '').trim());
        formData.set('slug', String(profile?.slug || '').trim());
        formData.set('promptId', String(profile?.promptId || '').trim());
        formData.set('pdfTemplate', String(profile?.pdfTemplate || '').trim());
        formData.set('pdfTemplateType', String(profile?.pdfTemplateType || '').trim());
        formData.set('pdfTemplateCss', String(profile?.pdfTemplateCss || '').trim());
        if (profile?.removePdfLogo) {
          formData.set('removePdfLogo', '1');
        }
        if (profile?.pdfLogo instanceof File || profile?.pdfLogo instanceof Blob) {
          const file = profile.pdfLogo;
          const fileName = typeof file.name === 'string' && file.name ? file.name : 'logo.pdf';
          formData.set('pdfLogo', file, fileName);
        }

        const response = await fetchWithAuth(
          `${normalizedBackend}/api/workspaces/${targetWorkspaceId}/profiles/${targetProfileId}`,
          {
            method: 'PUT',
            body: formData,
          }
        );

        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }

        if (!response.ok) {
          const message = payload?.message || `Aggiornamento profilo fallito (HTTP ${response.status})`;
          const details = Array.isArray(payload?.details) ? payload.details : [];
          pushLogs([`❌ ${message}`].concat(details));
          return { ok: false, message, details };
        }

        const normalizedProfile = normalizeWorkspaceProfile(targetWorkspaceId, payload?.profile);
        if (!normalizedProfile) {
          const message = 'Il profilo aggiornato non è valido.';
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }

        setWorkspaces((prev) =>
          prev.map((workspace) => {
            if (workspace.id !== targetWorkspaceId) {
              return workspace;
            }
            const baseProfiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
            const nextProfiles = baseProfiles.map((item) =>
              item.id === normalizedProfile.id ? normalizedProfile : item
            );
            return {
              ...workspace,
              profiles: sortWorkspaceProfiles(nextProfiles),
            };
          })
        );

        pushLogs([`✅ Profilo aggiornato: ${normalizedProfile.label}`]);
        return { ok: true, profile: normalizedProfile };
      } catch (error) {
        const message = error?.message || 'Errore durante l\'aggiornamento del profilo';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [backendUrl, fetchWithAuth, pushLogs]
  );

  const deleteWorkspaceProfile = useCallback(
    async (workspaceId, profileId) => {
      const targetWorkspaceId = typeof workspaceId === 'string' ? workspaceId.trim() : '';
      const targetProfileId = typeof profileId === 'string' ? profileId.trim() : '';
      if (!targetWorkspaceId || !targetProfileId) {
        const message = 'Workspace o profilo non valido per la rimozione.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      const normalizedBackend = normalizeBackendUrlValue(backendUrl);
      if (!normalizedBackend) {
        const message = 'Configura un backend valido per eliminare i profili.';
        pushLogs([`⚠️ ${message}`]);
        return { ok: false, message };
      }

      try {
        const response = await fetchWithAuth(
          `${normalizedBackend}/api/workspaces/${targetWorkspaceId}/profiles/${targetProfileId}`,
          {
            method: 'DELETE',
          }
        );

        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }

        if (!response.ok) {
          const message = payload?.message || `Eliminazione profilo fallita (HTTP ${response.status})`;
          pushLogs([`❌ ${message}`]);
          return { ok: false, message };
        }

        setWorkspaces((prev) =>
          prev.map((workspace) => {
            if (workspace.id !== targetWorkspaceId) {
              return workspace;
            }
            const baseProfiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
            return {
              ...workspace,
              profiles: sortWorkspaceProfiles(
                baseProfiles.filter((profile) => profile.id !== targetProfileId)
              ),
            };
          })
        );

        if (
          workspaceProfileSelection.workspaceId === targetWorkspaceId &&
          workspaceProfileSelection.profileId === targetProfileId
        ) {
          setWorkspaceProfileSelection({ workspaceId: targetWorkspaceId, profileId: '' });
          setWorkspaceProfileLocked(false);
          setCustomPdfLogo(null);
        }

        pushLogs([`🗑️ Profilo eliminato: ${targetProfileId}`]);
        return { ok: true };
      } catch (error) {
        const message = error?.message || 'Errore durante la rimozione del profilo';
        pushLogs([`❌ ${message}`]);
        return { ok: false, message };
      }
    },
    [
      backendUrl,
      fetchWithAuth,
      pushLogs,
      workspaceProfileSelection.workspaceId,
      workspaceProfileSelection.profileId,
      setWorkspaceProfileSelection,
      setWorkspaceProfileLocked,
      setCustomPdfLogo,
    ]
  );

  const handleSelectPromptTemplate = useCallback((prompt) => {
    if (!prompt || !prompt.id) {
      setPromptState(buildPromptState());
      return;
    }
    setPromptState((prev) => {
      if (prev.promptId === prompt.id) {
        return prev;
      }
      return buildPromptState({ promptId: prompt.id });
    });
  }, []);

  const handleClearPromptSelection = useCallback(() => {
    setPromptState(buildPromptState());
  }, []);

  const handlePromptFocusChange = useCallback(
    (value) => {
      setPromptFocus(value);
    },
    [setPromptFocus],
  );

  const handlePromptNotesChange = useCallback(
    (value) => {
      setPromptNotes(value);
    },
    [setPromptNotes],
  );

  const handleTogglePromptCue = useCallback((cueKey) => {
    setPromptState((prev) => {
      const next = {
        ...prev,
        cueProgress: { ...(prev.cueProgress || {}) },
      };
      next.cueProgress[cueKey] = !next.cueProgress[cueKey];
      return next;
    });
  }, []);

  const handleTogglePromptFavorite = useCallback((promptId) => {
    setPromptFavorites((prev) => {
      const set = new Set(prev);
      if (set.has(promptId)) {
        set.delete(promptId);
      } else {
        set.add(promptId);
      }
      return Array.from(set);
    });
  }, []);

  const handleRefreshPrompts = useCallback(() => {
    fetchPrompts({ silent: false });
  }, [fetchPrompts]);

  const handleCreatePrompt = useCallback(
    async (payload) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        return { ok: false, message: 'Configura un backend valido prima di creare prompt.' };
      }
      const result = await fetchBodyWithAuth(`${normalized}/api/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (result.ok) {
        const { prompt } = parsePromptResponse(result.data || {});
        if (prompt) {
          setPrompts((prev) => upsertPromptEntry(prev, prompt));
          return { ok: true, prompt };
        }
      }
      const message = result.data?.message || result.raw || 'Impossibile creare il prompt.';
      return { ok: false, message };
    },
    [backendUrl, fetchBodyWithAuth]
  );

  const handleDeletePrompt = useCallback(
    async (promptId) => {
      const normalized = normalizeBackendUrlValue(backendUrl);
      if (!normalized) {
        return { ok: false, message: 'Backend non configurato' };
      }
      const existingPrompt = findPromptByIdentifier(prompts, promptId);
      const result = await fetchBodyWithAuth(`${normalized}/api/prompts/${encodeURIComponent(promptId)}`, {
        method: 'DELETE',
      });
      if (result.ok) {
        const identifiersToClear = (() => {
          if (!existingPrompt) {
            return new Set([promptId]);
          }
          return new Set(collectPromptIdentifiers(existingPrompt));
        })();
        setPrompts((prev) => removePromptEntry(prev, promptId));
        setPromptFavorites((prev) => prev.filter((id) => !identifiersToClear.has(id)));
        setPromptState((prev) =>
          identifiersToClear.has(prev.promptId) ? buildPromptState() : prev
        );
      }
      return result;
    },
    [backendUrl, fetchBodyWithAuth, prompts]
  );

  const handleAdoptNavigatorSelection = useCallback(() => {
    if (!navigatorSelection.workspaceId || navigatorSelection.workspaceId === '__unassigned__') {
      setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
      setProjectCreationMode(false);
      setStatusCreationMode(false);
      setProjectDraft('');
      setStatusDraft('');
      setWorkspaceProfileSelection({ workspaceId: '', profileId: '' });
      setWorkspaceProfileLocked(false);
      return;
    }
    const workspace = workspaces.find((ws) => ws.id === navigatorSelection.workspaceId);
    if (!workspace) {
      setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
      setWorkspaceProfileSelection({ workspaceId: '', profileId: '' });
      setWorkspaceProfileLocked(false);
      return;
    }
    const workspaceProjectsArray = Array.isArray(workspace.projects) ? workspace.projects : [];
    let matchedProject = null;
    if (navigatorSelection.projectId) {
      matchedProject = workspaceProjectsArray.find((proj) => proj.id === navigatorSelection.projectId) || null;
      if (!matchedProject && navigatorSelection.projectName) {
        const targetName = navigatorSelection.projectName.toLowerCase();
        matchedProject =
          workspaceProjectsArray.find((proj) => (proj.name || '').toLowerCase() === targetName) || null;
      }
    }
    const candidateStatuses = matchedProject && Array.isArray(matchedProject.statuses) && matchedProject.statuses.length
      ? matchedProject.statuses
      : Array.isArray(workspace.defaultStatuses) && workspace.defaultStatuses.length
      ? workspace.defaultStatuses
      : DEFAULT_WORKSPACE_STATUSES;
    const normalizedStatus =
      navigatorSelection.status && candidateStatuses.includes(navigatorSelection.status)
        ? navigatorSelection.status
        : candidateStatuses[0] || '';
    setWorkspaceSelection({
      workspaceId: workspace.id,
      projectId: matchedProject?.id || '',
      projectName: matchedProject ? '' : navigatorSelection.projectName || '',
      status: normalizedStatus,
    });
    setWorkspaceProfileSelection({ workspaceId: workspace.id, profileId: '' });
    setWorkspaceProfileLocked(false);
    setProjectCreationMode(false);
    setStatusCreationMode(false);
    setProjectDraft('');
    setStatusDraft('');
  }, [navigatorSelection, workspaces]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceSelection.workspaceId) || null,
    [workspaces, workspaceSelection.workspaceId]
  );

  const workspaceProjects = useMemo(
    () => (Array.isArray(activeWorkspace?.projects) ? activeWorkspace.projects : []),
    [activeWorkspace]
  );

  const activeProject = useMemo(
    () => workspaceProjects.find((project) => project.id === workspaceSelection.projectId) || null,
    [workspaceProjects, workspaceSelection.projectId]
  );

  const activeWorkspaceProfiles = useMemo(
    () => (Array.isArray(activeWorkspace?.profiles) ? activeWorkspace.profiles : []),
    [activeWorkspace]
  );

  const activeWorkspaceProfile = useMemo(() => {
    if (!workspaceProfileSelection.profileId) {
      return null;
    }
    return (
      activeWorkspaceProfiles.find((profile) => profile.id === workspaceProfileSelection.profileId) || null
    );
  }, [activeWorkspaceProfiles, workspaceProfileSelection.profileId]);

  const availableStatuses = useMemo(() => {
    const candidate = (activeProject && Array.isArray(activeProject.statuses) && activeProject.statuses.length
      ? activeProject.statuses
      : Array.isArray(activeWorkspace?.defaultStatuses) && activeWorkspace.defaultStatuses.length
      ? activeWorkspace.defaultStatuses
      : DEFAULT_WORKSPACE_STATUSES);
    return Array.isArray(candidate) && candidate.length ? candidate : DEFAULT_WORKSPACE_STATUSES;
  }, [activeProject, activeWorkspace]);

  const selectedProjectDestDir = useMemo(
    () => sanitizeDestDirForRequest(activeProject?.destDir),
    [activeProject?.destDir]
  );
  const selectedWorkspaceDestDir = useMemo(
    () => sanitizeDestDirForRequest(activeWorkspace?.destDir),
    [activeWorkspace?.destDir]
  );

  useEffect(() => {
    if ((selectedProjectDestDir || selectedWorkspaceDestDir) && destDir !== '') {
      setDestDir('');
    }
  }, [selectedProjectDestDir, selectedWorkspaceDestDir, destDir, setDestDir]);

  const handleSelectWorkspaceForPipeline = useCallback(
    (value) => {
      const workspaceId = value || '';
      if (!workspaceId) {
        setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
        setProjectCreationMode(false);
        setStatusCreationMode(false);
        setProjectDraft('');
        setStatusDraft('');
        setWorkspaceProfileSelection({ workspaceId: '', profileId: '' });
        setWorkspaceProfileLocked(false);
        return;
      }
      const workspace = workspaces.find((ws) => ws.id === workspaceId);
      const firstProject = workspace?.projects?.[0] || null;
      const statuses = firstProject?.statuses && firstProject.statuses.length
        ? firstProject.statuses
        : workspace?.defaultStatuses && workspace.defaultStatuses.length
        ? workspace.defaultStatuses
        : DEFAULT_WORKSPACE_STATUSES;
      setWorkspaceSelection({
        workspaceId,
        projectId: firstProject?.id || '',
        projectName: '',
        status: statuses[0] || '',
      });
      setWorkspaceProfileSelection({ workspaceId, profileId: '' });
      setWorkspaceProfileLocked(false);
      if (workspaceProfileLocked) {
        setCustomPdfLogo(null);
      }
      setProjectCreationMode(false);
      setStatusCreationMode(false);
      setProjectDraft('');
      setStatusDraft('');
    },
    [workspaces, workspaceProfileLocked]
  );

  const handleSelectProjectForPipeline = useCallback(
    (value) => {
      if (value === '__new__') {
        setProjectCreationMode(true);
        setWorkspaceSelection((prev) => ({ ...prev, projectId: '', projectName: '' }));
        setProjectDraft('');
        return;
      }
      setProjectCreationMode(false);
      const project = workspaceProjects.find((proj) => proj.id === value) || null;
      const statuses = project?.statuses && project.statuses.length
        ? project.statuses
        : activeWorkspace?.defaultStatuses && activeWorkspace.defaultStatuses.length
        ? activeWorkspace.defaultStatuses
        : DEFAULT_WORKSPACE_STATUSES;
      setWorkspaceSelection((prev) => ({
        ...prev,
        projectId: value || '',
        projectName: '',
        status: prev.status && statuses.includes(prev.status) ? prev.status : (statuses[0] || ''),
      }));
      setStatusCreationMode(false);
      setStatusDraft('');
    },
    [workspaceProjects, activeWorkspace]
  );

  const handleSelectStatusForPipeline = useCallback((value) => {
    if (value === '__new__') {
      setStatusCreationMode(true);
      setWorkspaceSelection((prev) => ({ ...prev, status: '' }));
      setStatusDraft('');
      return;
    }
    setStatusCreationMode(false);
    setWorkspaceSelection((prev) => ({ ...prev, status: value || '' }));
  }, []);

  const handleSelectPdfTemplate = useCallback(
    (value) => {
      if (value && typeof value === 'object') {
        setPdfTemplateSelection((prev) => {
          const next = buildPdfTemplateSelection(value);
          if (
            prev.fileName === next.fileName &&
            prev.type === next.type &&
            prev.css === next.css
          ) {
            return prev;
          }
          return next;
        });
        return;
      }

      const fileName = typeof value === 'string' ? value.trim() : '';
      setPdfTemplateSelection((prev) => {
        if (!fileName) {
          if (!prev.fileName && !prev.type && !prev.css) {
            return prev;
          }
          return buildPdfTemplateSelection();
        }

        const template = pdfTemplates.find((item) => item.fileName === fileName) || null;
        const next = buildPdfTemplateSelection({
          fileName,
          type: template?.type || '',
          css: template?.cssFileName || '',
        });
        if (
          prev.fileName === next.fileName &&
          prev.type === next.type &&
          prev.css === next.css
        ) {
          return prev;
        }
        return next;
      });
    },
    [pdfTemplates]
  );

  const clearPdfTemplateSelection = useCallback(() => {
    setPdfTemplateSelection((prev) => {
      if (!prev.fileName && !prev.type && !prev.css) {
        return prev;
      }
      return buildPdfTemplateSelection();
    });
  }, []);

  useEffect(() => {
    if (!workspaceSelection.workspaceId) {
      setWorkspaceProfileSelection({ workspaceId: '', profileId: '' });
      setWorkspaceProfileLocked(false);
      return;
    }
    if (workspaceProfileSelection.workspaceId !== workspaceSelection.workspaceId) {
      setWorkspaceProfileSelection({ workspaceId: workspaceSelection.workspaceId, profileId: '' });
      setWorkspaceProfileLocked(false);
    }
  }, [workspaceSelection.workspaceId, workspaceProfileSelection.workspaceId]);

  useEffect(() => {
    setEnableDiarization(false);
  }, [workspaceSelection.workspaceId]);

  const resetDiarizationPreference = useCallback(() => {
    setEnableDiarization(false);
  }, []);

  const applyWorkspaceProfile = useCallback(
    (profileId, options = {}) => {
      const targetWorkspaceId = options.workspaceId || workspaceSelection.workspaceId;
      if (!targetWorkspaceId || !profileId) {
        return { ok: false, message: 'Workspace o profilo non selezionato' };
      }
      const workspace = workspaces.find((ws) => ws.id === targetWorkspaceId) || null;
      if (!workspace) {
        return { ok: false, message: 'Workspace non disponibile' };
      }
      const profiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
      const profile = profiles.find((item) => item.id === profileId) || null;
      if (!profile) {
        return { ok: false, message: 'Profilo non trovato' };
      }
      if (profile.slug) {
        setSlug(profile.slug);
      }
      if (profile.promptId) {
        setPromptState(buildPromptState({ promptId: profile.promptId }));
      }
      const descriptor = buildWorkspaceProfileLogoDescriptor(targetWorkspaceId, profile, {
        backendUrl: normalizeBackendUrlValue(backendUrl),
      });
      setCustomPdfLogo(descriptor || null);
      setWorkspaceProfileSelection({ workspaceId: targetWorkspaceId, profileId: profile.id });
      setWorkspaceProfileLocked(true);
      return { ok: true, profile };
    },
    [
      workspaces,
      workspaceSelection.workspaceId,
      setDestDir,
      setSlug,
      setPromptState,
      setCustomPdfLogo,
      backendUrl,
    ]
  );

  const clearWorkspaceProfile = useCallback(() => {
    setWorkspaceProfileSelection((prev) => ({
      workspaceId: prev.workspaceId || workspaceSelection.workspaceId || '',
      profileId: '',
    }));
    setWorkspaceProfileLocked(false);
    setCustomPdfLogo(null);
  }, [workspaceSelection.workspaceId, setCustomPdfLogo]);

  const resetInputSelections = useCallback(() => {
    setWorkspaceSelection({ workspaceId: '', projectId: '', projectName: '', status: '' });
    setWorkspaceProfileSelection({ workspaceId: '', profileId: '' });
    setWorkspaceProfileLocked(false);
    setProjectCreationMode(false);
    setStatusCreationMode(false);
    setProjectDraft('');
    setStatusDraft('');
    clearPdfTemplateSelection();
    setCustomPdfLogo(null);
    setDestDir(DEFAULT_DEST_DIR);
    setShowDestDetails(false);
    setSlug('meeting');
    setPromptState(buildPromptState());
  }, [
    clearPdfTemplateSelection,
    setCustomPdfLogo,
    setDestDir,
    setPromptState,
    setProjectCreationMode,
    setProjectDraft,
    setShowDestDetails,
    setSlug,
    setStatusCreationMode,
    setStatusDraft,
    setWorkspaceProfileLocked,
    setWorkspaceProfileSelection,
    setWorkspaceSelection,
  ]);

  const handleCreateProjectFromDraft = useCallback(async () => {
    const name = projectDraft.trim();
    if (!workspaceSelection.workspaceId || !name) {
      return;
    }
    const trimmedStatus = statusDraft.trim();
    const ensureResult = await handleEnsureWorkspaceProject(workspaceSelection.workspaceId, {
      projectName: name,
      status: trimmedStatus || workspaceSelection.status,
    });
    if (!ensureResult.ok) {
      return;
    }
    const resolvedWorkspace = ensureResult.workspace || activeWorkspace || null;
    const candidateProjects = Array.isArray(ensureResult.workspace?.projects)
      ? ensureResult.workspace.projects
      : Array.isArray(resolvedWorkspace?.projects)
      ? resolvedWorkspace.projects
      : [];
    const createdProject = ensureResult.project
      ? ensureResult.project
      : candidateProjects.find(
          (proj) => proj?.name && proj.name.toLowerCase() === name.toLowerCase(),
        ) || null;
    const fallbackStatuses = Array.isArray(resolvedWorkspace?.defaultStatuses) && resolvedWorkspace.defaultStatuses.length
      ? resolvedWorkspace.defaultStatuses
      : DEFAULT_WORKSPACE_STATUSES;
    const projectStatuses = Array.isArray(createdProject?.statuses) && createdProject.statuses.length
      ? createdProject.statuses
      : fallbackStatuses;
    const normalizedStatus = trimmedStatus
      || (workspaceSelection.status && projectStatuses.includes(workspaceSelection.status)
        ? workspaceSelection.status
        : projectStatuses[0] || '');

    setWorkspaceSelection({
      workspaceId: resolvedWorkspace?.id || workspaceSelection.workspaceId,
      projectId: createdProject?.id || workspaceSelection.projectId || '',
      projectName: createdProject ? '' : name,
      status: normalizedStatus,
    });
    setProjectCreationMode(false);
    setStatusCreationMode(false);
    setProjectDraft('');
    setStatusDraft('');
  }, [
    projectDraft,
    statusDraft,
    workspaceSelection.workspaceId,
    workspaceSelection.status,
    workspaceSelection.projectId,
    handleEnsureWorkspaceProject,
    activeWorkspace,
    DEFAULT_WORKSPACE_STATUSES,
    setWorkspaceSelection,
    setProjectCreationMode,
    setStatusCreationMode,
    setProjectDraft,
    setStatusDraft,
  ]);

  const handleCreateStatusFromDraft = useCallback(async () => {
    const newStatus = statusDraft.trim();
    if (!newStatus || !workspaceSelection.workspaceId) {
      return;
    }
    const ensureResult = await handleEnsureWorkspaceProject(workspaceSelection.workspaceId, {
      projectId: workspaceSelection.projectId,
      projectName: workspaceSelection.projectName,
      status: newStatus,
    });
    if (!ensureResult.ok) {
      return;
    }
    const resolvedWorkspace = ensureResult.workspace || activeWorkspace || null;
    const candidateProjects = Array.isArray(ensureResult.workspace?.projects)
      ? ensureResult.workspace.projects
      : Array.isArray(resolvedWorkspace?.projects)
      ? resolvedWorkspace.projects
      : [];
    const resolvedProject = ensureResult.project
      ? ensureResult.project
      : candidateProjects.find((proj) => proj.id === workspaceSelection.projectId)
      || candidateProjects.find(
        (proj) =>
          proj?.name && workspaceSelection.projectName && proj.name.toLowerCase() === workspaceSelection.projectName.toLowerCase(),
      )
      || null;
    const fallbackStatuses = Array.isArray(resolvedWorkspace?.defaultStatuses) && resolvedWorkspace.defaultStatuses.length
      ? resolvedWorkspace.defaultStatuses
      : DEFAULT_WORKSPACE_STATUSES;
    const projectStatuses = Array.isArray(resolvedProject?.statuses) && resolvedProject.statuses.length
      ? resolvedProject.statuses
      : fallbackStatuses;
    const normalizedStatus = projectStatuses.includes(newStatus)
      ? newStatus
      : projectStatuses[0] || newStatus;

    setWorkspaceSelection((prev) => ({
      ...prev,
      workspaceId: resolvedWorkspace?.id || prev.workspaceId,
      projectId: resolvedProject?.id || prev.projectId,
      projectName: resolvedProject ? '' : prev.projectName,
      status: normalizedStatus,
    }));
    setStatusDraft('');
    setStatusCreationMode(false);
  }, [
    statusDraft,
    workspaceSelection.workspaceId,
    workspaceSelection.projectId,
    workspaceSelection.projectName,
    handleEnsureWorkspaceProject,
    activeWorkspace,
    DEFAULT_WORKSPACE_STATUSES,
    setWorkspaceSelection,
    setStatusDraft,
    setStatusCreationMode,
  ]);

  const processViaBackend=async()=>{
    const blob=audioBlob;
    if(!blob) return;
    const blobSource='name'in blob?'upload':'recording';
    if(!backendUrl){
      setErrorBanner({title:'Backend URL mancante',details:`Imposta ${DEFAULT_BACKEND_URL} o il tuo endpoint.`});
      return;
    }
    revealPipelinePanel();
    resetPipelineProgress(true);
    setShowRawLogs(false);
    setBusy(true);
    setLogs([]);
    setPdfPath("");
    setMdPath("");
    setErrorBanner(null);
    const runStartedAt=new Date();
    const durationSeconds=Number.isFinite(elapsed)?elapsed:null;
    const sessionLogs=[];
    const appendLogs=(entries)=>{
      const sanitized=(entries||[]).filter(Boolean);
      if(!sanitized.length) return;
      sessionLogs.push(...sanitized);
      setLogs(ls=>ls.concat(sanitized));
    };
    let refinedPayloadForUpload=null;
    const refinedValidation=normalizeRefinedDataForUpload(refinedData);
    if(!refinedValidation.ok){
      const message=refinedValidation.error||'Dati di raffinazione non validi.';
      handlePipelineEvents([
        { stage: 'upload', status: 'failed', message },
        { stage: 'complete', status: 'failed', message },
      ],{ animate:false });
      appendLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Dati di raffinazione non validi', details: message });
      setBusy(false);
      return;
    }
    refinedPayloadForUpload=refinedValidation.value;
    try{
      const fd=new FormData();
      const m=(mime||blob.type||"").toLowerCase();
      const ext=m.includes('webm')?'webm':m.includes('ogg')?'ogg':m.includes('wav')?'wav':'m4a';
      fd.append('audio',blob,`${blobSource}.${ext}`);
      appendPdfLogoIfPresent(fd, customPdfLogo);
      const isPlaceholder=isDestDirPlaceholder(destDir);
      if (!isPlaceholder) {
        fd.append('dest',destDir);
      } else {
        appendLogs(["ℹ️ Cartella destinazione non specificata o segnaposto: il backend userà la sua cartella predefinita."]);
      }
      fd.append('slug',slug||'meeting');
      if (workspaceSelection.workspaceId) {
        fd.append('workspaceId', workspaceSelection.workspaceId);
        if (workspaceSelection.projectId) {
          fd.append('workspaceProjectId', workspaceSelection.projectId);
        }
        if (workspaceSelection.projectName) {
          fd.append('workspaceProjectName', workspaceSelection.projectName);
        }
        if (workspaceSelection.status) {
          fd.append('workspaceStatus', workspaceSelection.status);
        }
        if (selectedWorkspaceDestDir) {
          fd.append('workspaceDestDir', selectedWorkspaceDestDir);
        }
        if (selectedProjectDestDir) {
          fd.append('workspaceProjectDestDir', selectedProjectDestDir);
        }
      }
      if (aiProviderOverrides.text) {
        fd.append('aiTextProvider', aiProviderOverrides.text);
      }
      if (aiProviderOverrides.embedding) {
        fd.append('aiEmbeddingProvider', aiProviderOverrides.embedding);
      }
      appendWorkspaceProfileDetails(fd, {
        selection: workspaceProfileSelection,
        profile: activeWorkspaceProfile,
        logoDescriptor: customPdfLogo,
        backendUrl: normalizeBackendUrlValue(backendUrl),
      });
      if (!workspaceProfileLocked) {
        appendPdfTemplateSelection(fd, pdfTemplateSelection);
      }
      if (promptState.promptId) {
        fd.append('promptId', promptState.promptId);
        if (promptState.focus && promptState.focus.trim()) {
          fd.append('promptFocus', promptState.focus.trim());
        }
        if (promptState.notes && promptState.notes.trim()) {
          fd.append('promptNotes', promptState.notes.trim());
        }
        if (promptCompletedCues.length) {
          fd.append('promptCuesCompleted', JSON.stringify(promptCompletedCues));
        }
      }
      if(enableDiarization){
        fd.append('diarize','true');
        appendLogs(['🗣️ Modalità riunione attivata: verrà eseguita la diarizzazione degli speaker.']);
      }
      const cap=Number(secondsCap||0);
      if(cap>0) fd.append('seconds',String(cap));
      if(refinedPayloadForUpload){
        fd.append('refinedData',JSON.stringify(refinedPayloadForUpload));
      }
      const {ok,status,data,raw}=await fetchBodyWithAuth(`${backendUrl}/api/rec2pdf`,{method:'POST',body:fd});
      const stageEventsPayload = Array.isArray(data?.stageEvents) ? data.stageEvents : [];
      if(!ok){
        if (stageEventsPayload.length) {
          handlePipelineEvents(stageEventsPayload, { animate: false });
        } else {
          const fallbackMessage = data?.message || (raw ? raw.slice(0, 120) : status === 0 ? 'Connessione fallita/CORS' : 'Errore backend');
          handlePipelineEvents([
            { stage: 'complete', status: 'failed', message: fallbackMessage },
          ], { animate: false });
        }
        if(data?.logs?.length) appendLogs(data.logs);
        if(data?.message) appendLogs([`❌ ${data.message}`]);
        if(!data&&raw) appendLogs([`❌ Risposta server: ${raw.slice(0,400)}${raw.length>400?'…':''}`]);
        appendLogs([`Errore backend: HTTP ${status||'0 (rete)'}`]);
        setErrorBanner({title:`Errore backend (HTTP ${status||'0'})`,details:data?.message||(raw?raw.slice(0,400):(status===0?'Connessione fallita/CORS':'Errore sconosciuto'))});
        return;
      }
      const successEvents = stageEventsPayload.length
        ? stageEventsPayload
        : [{ stage: 'complete', status: 'done', message: 'Pipeline completata' }];
      handlePipelineEvents(successEvents, { animate: true });
      if(data?.logs) appendLogs(data.logs);
      if(data?.pdfPath){
        setPdfPath(data.pdfPath);
        setMdPath(data.mdPath || "");
        const normalizedBackend = normalizeBackendUrlValue(backendUrl || '');
        const pdfUrl = buildFileUrl(normalizedBackend, data.pdfPath);
        const mdUrl = buildFileUrl(normalizedBackend, data?.mdPath || '');
        const logosUsed={
          frontend: customLogo?'custom':'default',
          pdf: resolvePdfLogoLabel(customPdfLogo),
        };
        const structureMeta = data?.structure || null;
        if (structureMeta && Number.isFinite(structureMeta.score)) {
          appendLogs([`📊 Completezza stimata: ${structureMeta.score}%`]);
          if (Array.isArray(structureMeta.missingSections) && structureMeta.missingSections.length) {
            appendLogs([`🧩 Sezioni mancanti: ${structureMeta.missingSections.join(', ')}`]);
          }
        }
        const fallbackPrompt = promptState.promptId
          ? {
              id: promptState.promptId,
              title: activePrompt?.title || '',
              slug: activePrompt?.slug || '',
              description: activePrompt?.description || '',
              persona: activePrompt?.persona || '',
              color: activePrompt?.color || '#6366f1',
              tags: Array.isArray(activePrompt?.tags) ? activePrompt.tags : [],
              cueCards: Array.isArray(activePrompt?.cueCards) ? activePrompt.cueCards : [],
              checklist: activePrompt?.checklist || null,
              markdownRules: activePrompt?.markdownRules || null,
              pdfRules: activePrompt?.pdfRules || null,
              focus: promptState.focus || '',
              notes: promptState.notes || '',
              completedCues: promptCompletedCues,
              builtIn: Boolean(activePrompt?.builtIn),
            }
          : null;
        const promptSummary = data?.prompt || fallbackPrompt;
        const historyEntry=hydrateHistoryEntry({
          id:Date.now(),
          timestamp:runStartedAt.toISOString(),
          slug:slug||'meeting',
          title:slug||'Sessione',
          duration:durationSeconds,
          pdfPath:data.pdfPath,
          pdfUrl,
          mdPath:data?.mdPath||'',
          mdUrl,
          localPdfPath: data?.localPdfPath || '',
          localMdPath: data?.localMdPath || '',
          backendUrl:normalizedBackend,
          logos:logosUsed,
          tags:[],
          logs:sessionLogs,
          stageEvents: successEvents,
          source:blobSource,
          bytes:blob.size||null,
          workspace: data?.workspace || (workspaceSelection.workspaceId
            ? {
                id: workspaceSelection.workspaceId,
                name: '',
                client: '',
                color: '#6366f1',
                projectId: workspaceSelection.projectId || '',
                projectName: workspaceSelection.projectName || '',
                status: workspaceSelection.status || '',
              }
            : null),
          structure: structureMeta,
          prompt: promptSummary,
          speakers: Array.isArray(data?.speakers) ? data.speakers : [],
          speakerMap: data?.speakerMap || {},
          refinedData: data?.refinedData || refinedPayloadForUpload || null,
        });
        setHistory(prev=>{
          const next=[historyEntry,...prev];
          return next.slice(0,HISTORY_LIMIT);
        });
        fetchWorkspaces({ silent: true });
        appendLogs([`💾 Sessione salvata nella Libreria (${historyEntry.title}).`]);
      } else {
        appendLogs(["⚠️ Risposta senza pdfPath."]);
      }
    } finally{
      setBusy(false);
    }
  };

  const processMarkdownUpload=async(file,options={})=>{
    if(!file) return;
    if(!backendUrl){
      setErrorBanner({title:'Backend URL mancante',details:`Imposta ${DEFAULT_BACKEND_URL} o il tuo endpoint.`});
      return;
    }
    const endpointOverride=options.endpoint;
    const fileFieldName=options.fileFieldName||'markdown';
    const startMessage=options.startMessage||`🚀 Avvio impaginazione da Markdown: ${file.name}`;
    const fallbackEventsOverride=Array.isArray(options.fallbackEvents)?options.fallbackEvents:null;
    const extraFormData=options.extraFormData||null;
    resetPipelineProgress(true);
    setShowRawLogs(false);
    setBusy(true);
    setLogs([]);
    setPdfPath("");
    setMdPath("");
    setErrorBanner(null);
    const sessionLogs=[];
    const appendLogs=(entries)=>{
      const sanitized=(entries||[]).filter(Boolean);
      if(!sanitized.length) return;
      sessionLogs.push(...sanitized);
      setLogs(ls=>ls.concat(sanitized));
    };
    const isPlaceholder=isDestDirPlaceholder(destDir);
    if(isPlaceholder){
      appendLogs(["ℹ️ Cartella destinazione non specificata o segnaposto: il backend userà la sua cartella predefinita."]); 
    }
    appendLogs([startMessage]);
    try{
      const fd=new FormData();
      fd.append(fileFieldName,file,file.name);
      appendPdfLogoIfPresent(fd, customPdfLogo);
      if(!isPlaceholder){
        fd.append('dest',destDir);
      }
      const slugValue=(slug||file.name.replace(/\.[^.]+$/i,'')||'documento').trim();
      if(slugValue){
        fd.append('slug',slugValue);
      }
      if (workspaceSelection.workspaceId) {
        fd.append('workspaceId', workspaceSelection.workspaceId);
        if (workspaceSelection.projectId) {
          fd.append('workspaceProjectId', workspaceSelection.projectId);
        }
        if (workspaceSelection.projectName) {
          fd.append('workspaceProjectName', workspaceSelection.projectName);
        }
        if (workspaceSelection.status) {
          fd.append('workspaceStatus', workspaceSelection.status);
        }
        if (selectedWorkspaceDestDir) {
          fd.append('workspaceDestDir', selectedWorkspaceDestDir);
        }
        if (selectedProjectDestDir) {
          fd.append('workspaceProjectDestDir', selectedProjectDestDir);
        }
      }
      appendWorkspaceProfileDetails(fd, {
        selection: workspaceProfileSelection,
        profile: activeWorkspaceProfile,
        logoDescriptor: customPdfLogo,
        backendUrl: normalizeBackendUrlValue(backendUrl),
      });
      if (!workspaceProfileLocked) {
        appendPdfTemplateSelection(fd, pdfTemplateSelection);
      }
      if (promptState.promptId) {
        fd.append('promptId', promptState.promptId);
        if (promptState.focus && promptState.focus.trim()) {
          fd.append('promptFocus', promptState.focus.trim());
        }
        if (promptState.notes && promptState.notes.trim()) {
          fd.append('promptNotes', promptState.notes.trim());
        }
        if (promptCompletedCues.length) {
          fd.append('promptCuesCompleted', JSON.stringify(promptCompletedCues));
        }
      }
      if (aiProviderOverrides.text) {
        fd.append('aiTextProvider', aiProviderOverrides.text);
      }
      if (aiProviderOverrides.embedding) {
        fd.append('aiEmbeddingProvider', aiProviderOverrides.embedding);
      }
      if(extraFormData&&typeof extraFormData==='object'){
        Object.entries(extraFormData).forEach(([key,value])=>{
          if(typeof value==='undefined'||value===null) return;
          fd.append(key,value);
        });
      }
      const targetEndpoint=endpointOverride||`${backendUrl}/api/ppubr-upload`;
      let endpointLabel='/api/ppubr-upload';
      try{
        const parsed=new URL(targetEndpoint);
        endpointLabel=parsed.pathname||endpointLabel;
      }catch{
        const match=targetEndpoint.match(/\/api\/[a-zA-Z0-9_-]+/);
        if(match&&match[0]) endpointLabel=match[0];
        else endpointLabel=targetEndpoint;
      }
      const {ok,status,data,raw,contentType}=await fetchBodyWithAuth(targetEndpoint,{method:'POST',body:fd});
      const stageEventsPayload=Array.isArray(data?.stageEvents)?data.stageEvents:[];
      if(!ok){
        if(stageEventsPayload.length){
          handlePipelineEvents(stageEventsPayload,{animate:false});
        }else{
          let fallbackMessage=data?.message||(raw?raw.slice(0,200):status===0?'Connessione fallita/CORS':'Errore backend');
          if(status===404&&(raw.includes('Endpoint')||raw.includes('Cannot POST'))){
            fallbackMessage=`Endpoint ${endpointLabel} non disponibile sul backend. Riavvia o aggiorna il server.`;
          }
          handlePipelineEvents([
            {stage:'publish',status:'failed',message:fallbackMessage},
            {stage:'complete',status:'failed',message:'Pipeline interrotta'},
          ],{animate:false});
        }
        if(data?.logs?.length) appendLogs(data.logs);
        let message=data?.message||(raw?raw.slice(0,200):status===0?'Connessione fallita/CORS':'Errore backend');
        if(status===404&&(raw.includes('Endpoint')||raw.includes('Cannot POST'))){
          message=`Endpoint ${endpointLabel} non disponibile sul backend. Riavvia o aggiorna il server.`;
        } else if(status===404&&!contentType?.includes('application/json')){
          message='Risposta non valida dal backend (HTML/404). Controlla la versione del server.';
        }
        appendLogs([`❌ ${message}`]);
        setErrorBanner({title:'Impaginazione fallita',details:message});
        return;
      }
      const fallbackEvents=fallbackEventsOverride&&fallbackEventsOverride.length?fallbackEventsOverride:[
        {stage:'upload',status:'completed',message:'Markdown caricato manualmente.'},
        {stage:'transcode',status:'completed',message:'Step non necessario.'},
        {stage:'transcribe',status:'completed',message:'Trascrizione non richiesta.'},
        {stage:'markdown',status:'completed',message:'Markdown fornito.'},
        {stage:'publish',status:'completed',message:'PPUBR completato.'},
        {stage:'complete',status:'completed',message:'Pipeline conclusa.'},
      ];
      const successEvents=stageEventsPayload.length?stageEventsPayload:fallbackEvents;
      handlePipelineEvents(successEvents,{animate:true});
      if(data?.logs?.length) appendLogs(data.logs);
      if(data?.pdfPath){
        setPdfPath(data.pdfPath);
        setMdPath(data?.mdPath||"");
        appendLogs([`✅ PDF generato: ${data.pdfPath}`]);
        const normalizedBackend=normalizeBackendUrlValue(backendUrl||'');
        const pdfUrl=buildFileUrl(normalizedBackend,data.pdfPath);
        const mdUrl=buildFileUrl(normalizedBackend,data?.mdPath||'');
        const logosUsed={
          frontend:customLogo?'custom':'default',
          pdf:resolvePdfLogoLabel(customPdfLogo),
        };
        const structureMeta = data?.structure || null;
        if (structureMeta && Number.isFinite(structureMeta.score)) {
          appendLogs([`📊 Completezza stimata: ${structureMeta.score}%`]);
          if (Array.isArray(structureMeta.missingSections) && structureMeta.missingSections.length) {
            appendLogs([`🧩 Sezioni mancanti: ${structureMeta.missingSections.join(', ')}`]);
          }
        }
        const fallbackPrompt = promptState.promptId
          ? {
              id: promptState.promptId,
              title: activePrompt?.title || '',
              slug: activePrompt?.slug || '',
              description: activePrompt?.description || '',
              persona: activePrompt?.persona || '',
              color: activePrompt?.color || '#6366f1',
              tags: Array.isArray(activePrompt?.tags) ? activePrompt.tags : [],
              cueCards: Array.isArray(activePrompt?.cueCards) ? activePrompt.cueCards : [],
              checklist: activePrompt?.checklist || null,
              markdownRules: activePrompt?.markdownRules || null,
              pdfRules: activePrompt?.pdfRules || null,
              focus: promptState.focus || '',
              notes: promptState.notes || '',
              completedCues: promptCompletedCues,
              builtIn: Boolean(activePrompt?.builtIn),
            }
          : null;
        const promptSummary = data?.prompt || fallbackPrompt;
        const historyEntry=hydrateHistoryEntry({
          id:Date.now(),
          timestamp:new Date().toISOString(),
          slug:slugValue||'documento',
          title:slugValue||file.name,
          duration:null,
          pdfPath:data.pdfPath,
          pdfUrl,
          mdPath:data?.mdPath||'',
          mdUrl,
          localPdfPath: data?.localPdfPath || '',
          localMdPath: data?.localMdPath || '',
          backendUrl:normalizedBackend,
          logos:logosUsed,
          tags:[],
          logs:sessionLogs,
          stageEvents:successEvents,
          source:'markdown-upload',
          bytes:file.size||null,
          workspace: data?.workspace || (workspaceSelection.workspaceId
            ? {
                id: workspaceSelection.workspaceId,
                name: '',
                client: '',
                color: '#6366f1',
                projectId: workspaceSelection.projectId || '',
                projectName: workspaceSelection.projectName || '',
                status: workspaceSelection.status || '',
              }
            : null),
          structure: structureMeta,
          prompt: promptSummary,
          speakers: Array.isArray(data?.speakers) ? data.speakers : [],
          speakerMap: data?.speakerMap || {},
        });
        setHistory(prev=>{
          const next=[historyEntry,...prev];
          return next.slice(0,HISTORY_LIMIT);
        });
        setActivePanel('doc');
        appendLogs([`💾 Sessione Markdown salvata nella Libreria (${historyEntry.title}).`]);
        fetchWorkspaces({ silent: true });
      }else{
        appendLogs(['⚠️ Risposta backend senza percorso PDF.']);
      }
    }catch(err){
      const message=err?.message||String(err);
      appendLogs([`❌ ${message}`]);
      handlePipelineEvents([
        {stage:'publish',status:'failed',message},
        {stage:'complete',status:'failed',message:'Pipeline interrotta'},
      ],{animate:false});
      setErrorBanner({title:'Impaginazione fallita',details:message});
    }finally{
      setBusy(false);
      if(markdownInputRef.current){
        markdownInputRef.current.value='';
      }
    }
  };

  // TODO(Task 3): Surface this handler through the Base upload bar for .md
  // files alongside audio and .txt inputs.
  const handleMarkdownFilePicked=(event)=>{
    const file=event.target?.files?.[0];
    if(!file) return;
    if(!/\.md$/i.test(file.name)){
      setErrorBanner({title:'Formato non supportato',details:'Seleziona un file con estensione .md'});
      if(markdownInputRef.current){
        markdownInputRef.current.value='';
      }
      return;
    }
    setLastMarkdownUpload({name:file.name,size:file.size,ts:Date.now()});
    processMarkdownUpload(file);
  };

  const processTextUpload = async (file) => {
    if (!file) return;
    try {
      await processMarkdownUpload(file,{
        endpoint:`${backendUrl}/api/text-upload`,
        fileFieldName:'transcript',
        startMessage:`🚀 Avvio conversione da TXT: ${file.name}`,
        fallbackEvents:[
          {stage:'upload',status:'completed',message:'File TXT caricato.'},
          {stage:'transcode',status:'completed',message:'Step non necessario.'},
          {stage:'transcribe',status:'completed',message:'Trascrizione fornita come testo.'},
          {stage:'markdown',status:'completed',message:'Markdown generato dal TXT.'},
          {stage:'publish',status:'completed',message:'PPUBR completato.'},
          {stage:'complete',status:'completed',message:'Pipeline conclusa.'},
        ],
        extraFormData:{ sourceType:'txt' },
      });
    } catch (error) {
      const message = error?.message || String(error);
      setErrorBanner({ title: 'Conversione testo fallita', details: message });
    } finally {
      if (textInputRef.current) {
        textInputRef.current.value = '';
      }
    }
  };

  // TODO(Task 3): Expose this TXT ingestion path via the Base upload bar to
  // keep advanced mode focused on configuration only.
  const handleTextFilePicked = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (!/\.txt$/i.test(file.name)){
      setErrorBanner({title:'Formato non supportato',details:'Seleziona un file con estensione .txt'});
      if(textInputRef.current){
        textInputRef.current.value='';
      }
      return;
    }
    setLastTextUpload({ name: file.name, size: file.size, ts: Date.now() });
    await processTextUpload(file);
  };

  const runDiagnostics=useCallback(async()=>{ setBusy(true); setLogs([]); setErrorBanner(null); try{ const {ok,status,data,raw}=await runBackendDiagnostics(); if(data?.logs?.length) pushLogs(data.logs); if(!ok){ pushLogs([`❌ Diagnostica fallita (HTTP ${status||'0'})`]); if(!data&&raw) pushLogs([raw.slice(0,400)]); setErrorBanner({title:`Diagnostica fallita (HTTP ${status||'0'})`,details:data?.message||raw||'Errore rete/CORS'}); setBackendUp(false); } else { pushLogs([data?.ok?'✅ Ambiente OK':'❌ Ambiente con problemi']); } } finally{ setBusy(false); } },[pushLogs, runBackendDiagnostics, setBackendUp]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (onboardingComplete) {
      localStorage.setItem('onboardingComplete', 'true');
    } else {
      localStorage.removeItem('onboardingComplete');
    }
  }, [onboardingComplete]);

  const backendUrlValid = useMemo(() => {
    if (!backendUrl) return false;
    try {
      const parsed = new URL(backendUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, [backendUrl]);

  const diagUrl = useMemo(() => {
    if (!backendUrlValid || !backendUrl) return '';
    const trimmed = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    return `${trimmed}/api/diag`;
  }, [backendUrl, backendUrlValid]);

  const shouldShowOnboardingBanner = useMemo(() => diagnostics.status === 'error', [diagnostics.status]);

  const openMicSettings = useCallback(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator?.userAgent || '';
    if (ua.includes('Firefox')) {
      window.open('about:preferences#privacy', '_blank');
    } else if (ua.includes('Edg/')) {
      window.open('edge://settings/content/microphone', '_blank');
    } else if (ua.includes('OPR/') || ua.includes('Opera')) {
      window.open('opera://settings/content/microphone', '_blank');
    } else {
      window.open('chrome://settings/content/microphone', '_blank');
    }
  }, []);

  const handleBackendDefault = useCallback(() => {
    setBackendUrl(DEFAULT_BACKEND_URL);
  }, [setBackendUrl]);

  const handleBackendSettings = useCallback(() => {
    openSettingsDrawer('advanced');
  }, [openSettingsDrawer]);

  const onboardingSteps = useMemo(() => {
    const micStatus = permission==='granted'?'success':permission==='denied'?'error':'pending';
    const micMessage = permissionMessage || (micStatus==='success'?'Il permesso microfono è attivo.':'Concedi il permesso microfono per registrare direttamente dall\'app.');
    const micActions = [
      { label:'Richiedi accesso microfono', onClick:requestPermission, disabled:permission==='granted' },
      { label:'Aggiorna dispositivi', onClick:refreshDevices, variant:'secondary' },
    ];
    if(permission==='denied'){
      micActions.push({ label:'Apri impostazioni browser', onClick:openMicSettings, variant:'subtle' });
    }

    const urlStatus = !backendUrl ? 'pending' : backendUrlValid ? 'success' : 'error';
    const urlMessage = !backendUrl
      ? `Inserisci l'URL del backend (es. ${DEFAULT_BACKEND_URL}).`
      : backendUrlValid
        ? 'URL valido: il frontend può contattare il backend.'
        : 'Controlla che l\'URL includa protocollo (http/https) e porta corretti.';
    const urlActions = [
      { label:'Imposta localhost', onClick:handleBackendDefault, variant:'secondary' },
      { label:'Apri impostazioni backend', onClick:handleBackendSettings, variant:'subtle' },
    ];

    const healthStatus = backendUp===null?'pending':backendUp?'success':'error';
    const healthMessage = backendUp===null
      ? 'Esegui una verifica per assicurarti che il backend risponda a /api/health.'
      : backendUp
        ? 'Il backend risponde correttamente all\'endpoint /api/health.'
        : 'Backend non raggiungibile. Avvia il servizio e riprova.';
    const healthActions = [
      { label:checkingHealth?'Verifica in corso…':'Verifica connessione', onClick:checkHealth, disabled:checkingHealth, variant:'primary' },
    ];
    if(backendUrlValid){
      healthActions.push({ label:'Apri backend', href:backendUrl, variant:'subtle' });
    }

    const diagStatusKey = diagnostics.status;
    const diagStatus = diagStatusKey==='success'?'success':diagStatusKey==='error'?'error':'pending';
    const diagMessage = diagStatusKey==='success'
      ? 'La diagnostica ha confermato che l\'ambiente è pronto.'
      : diagStatusKey==='error'
        ? (diagnostics.message || 'La diagnostica ha rilevato problemi nella toolchain.')
        : 'Esegui /api/diag per verificare ffmpeg, template e permessi filesystem.';
    const diagActions = [
      { label:busy?'Diagnostica in corso…':'Esegui diagnostica', onClick:runDiagnostics, disabled:busy, variant:'primary' },
    ];
    if(diagUrl){
      diagActions.push({ label:'Apri /api/diag', href:diagUrl, variant:'subtle' });
    }

    const diagLogsPreview = diagnostics.logs?.slice(-3) || [];

    return [
      {
        key:'microphone',
        title:'Permessi microfono',
        subtitle:'Browser & hardware',
        icon:Mic,
        status:micStatus,
        statusLabel:micStatus==='success'?'OK':micStatus==='error'?'Bloccato':'In attesa',
        headline:micStatus==='success'?'Microfono pronto alla registrazione':'Consenti l\'accesso al microfono',
        body:(
          <>
            <p>{micMessage}</p>
            <ul className="mt-3 space-y-1 text-xs text-zinc-200">
              <li>Permesso attuale: <code className="text-zinc-100">{permission}</code></li>
              <li>HTTPS / localhost: {secureOK?'✅':'⚠️ richiesto'}</li>
              <li>getUserMedia: {mediaSupported?'✅ supportato':'⚠️ non disponibile'}</li>
              <li>MediaRecorder: {recorderSupported?'✅ supportato':'⚠️ non disponibile (usa il caricamento file)'}</li>
            </ul>
          </>
        ),
        extra:lastMicError?(<div className="text-xs text-rose-200">Ultimo errore: {lastMicError.name}{lastMicError.message?` – ${lastMicError.message}`:''}</div>):null,
        actions:micActions,
      },
      {
        key:'backend-url',
        title:'URL backend',
        subtitle:'Connessione',
        icon:LinkIcon,
        status:urlStatus,
        statusLabel:urlStatus==='success'?'OK':urlStatus==='error'?'Correggi':'In attesa',
        headline:urlStatus==='success'?'Endpoint configurato':'Configura l\'URL del backend',
        body:(
          <>
            <p>{urlMessage}</p>
            <div className="mt-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">{backendUrl || '—'}</div>
          </>
        ),
        actions:urlActions,
      },
      {
        key:'health',
        title:'/api/health',
        subtitle:'Stato servizio',
        icon:CheckCircle2,
        status:healthStatus,
        statusLabel:healthStatus==='success'?'Online':healthStatus==='error'?'Offline':'In attesa',
        headline:healthStatus==='success'?'Backend raggiungibile':'Verifica salute del backend',
        body:(
          <>
            <p>{healthMessage}</p>
            <p className="text-xs text-zinc-300">Ultimo risultato: {backendUp===null?'—':backendUp?'✅ OK':'❌ Offline'}</p>
          </>
        ),
        actions:healthActions,
      },
      {
        key:'diagnostics',
        title:'/api/diag',
        subtitle:'Toolchain',
        icon:Bug,
        status:diagStatus,
        statusLabel:diagStatusKey==='running'?'In corso':diagStatus==='success'?'OK':diagStatus==='error'?'Problemi':'In attesa',
        headline:diagStatus==='success'?'Ambiente validato':'Esegui la diagnostica del backend',
        body:(
          <>
            <p>{diagMessage}</p>
          </>
        ),
        extra:diagLogsPreview.length?(<div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3 text-xs text-zinc-300 space-y-1">{diagLogsPreview.map((log,index)=>(<div key={index} className="font-mono">{log}</div>))}</div>):null,
        actions:diagActions,
      },
    ];
  }, [permission, permissionMessage, secureOK, mediaSupported, recorderSupported, lastMicError, requestPermission, refreshDevices, openMicSettings, backendUrl, backendUrlValid, handleBackendDefault, handleBackendSettings, backendUp, checkingHealth, checkHealth, diagnostics.status, diagnostics.message, diagnostics.logs, busy, runDiagnostics, diagUrl]);

  useEffect(() => {
    if (!onboardingSteps.length) return;
    if (onboardingSteps.every(step => step.status === 'success')) {
      setOnboardingComplete(true);
      setShowSetupAssistant(false);
    }
  }, [onboardingSteps, setShowSetupAssistant]);

  useEffect(() => {
    if (!showSetupAssistant || !onboardingSteps.length) return;
    const firstIncomplete = onboardingSteps.findIndex(step => step.status !== 'success');
    const targetIndex = firstIncomplete === -1 ? onboardingSteps.length - 1 : firstIncomplete;
    if (targetIndex !== onboardingStep) {
      setOnboardingStep(targetIndex);
    }
  }, [showSetupAssistant, onboardingSteps, onboardingStep]);

  const openSetupAssistant = useCallback(() => {
    const firstIncomplete = onboardingSteps.findIndex(step => step.status !== 'success');
    setOnboardingStep(firstIncomplete === -1 ? onboardingSteps.length - 1 : firstIncomplete);
    openSettingsDrawer('diagnostics', { showAssistant: true });
  }, [
    onboardingSteps,
    setOnboardingStep,
    openSettingsDrawer,
  ]);

  const handleOnboardingFinish = useCallback(() => {
    setOnboardingComplete(true);
    setShowSetupAssistant(false);
  }, [setOnboardingComplete, setShowSetupAssistant]);

  const onPickFile=(e)=>{ const f=e.target.files?.[0]; if(!f) return; resetCreationFlowState(); setAudioBlob(f); setAudioUrl(URL.createObjectURL(f)); setMime(f.type||""); setErrorBanner(null); revealPublishPanel(); };

  const cycleTheme = () => {
    const themeKeys = Object.keys(themes);
    const currentIndex = themeKeys.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeKeys.length;
    setTheme(themeKeys[nextIndex]);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const normalizedBackendUrl = useMemo(() => normalizeBackendUrlValue(backendUrl), [backendUrl]);

  const mdEditorDirty = useMemo(() => mdEditor.content !== mdEditor.originalContent, [mdEditor.content, mdEditor.originalContent]);
  const speakerMapHasNames = useMemo(
    () => hasNamedSpeakers(mdEditor.speakerMap),
    [mdEditor.speakerMap]
  );

  const handleOpenHistoryPdf = useCallback(
    async (entry) => {
      if (!entry?.pdfPath) return;

      const rawPdfUrl = typeof entry.pdfUrl === 'string' ? entry.pdfUrl : '';
      const isBackendProxyUrl = rawPdfUrl.includes('/api/file?');
      const directUrl = rawPdfUrl.startsWith('http') && !isBackendProxyUrl ? rawPdfUrl : '';

      const backendTarget = entry?.backendUrl || normalizedBackendUrl;
      if (!directUrl && !normalizeBackendUrlValue(backendTarget)) {
        pushLogs(['❌ Backend non configurato per aprire il PDF.']);
        return;
      }

      try {
        await openSignedFileInNewTab({
          backendUrl: backendTarget,
          path: entry.pdfPath,
          label: 'PDF',
          directUrl,
        });
      } catch (error) {
        const message = error?.message || 'Impossibile aprire il PDF.';
        pushLogs([`❌ ${message}`]);
      }
    },
    [normalizedBackendUrl, openSignedFileInNewTab, pushLogs]
  );

  const handleOpenHistoryMd = useCallback(
    async (entry, overrideMdPath, options = {}) => {
      const { openInNewTab = false, skipEditor = false, backendUrlOverride, directUrlOverride } = options || {};

      const mdPathResolved = overrideMdPath || deriveMarkdownPath(entry?.mdPath, entry?.pdfPath);
      if (!mdPathResolved) {
        const label = entry?.title || entry?.slug || 'sessione';
        pushLogs([`❌ Percorso del testo non disponibile per ${label}.`]);
        return;
      }

      const backendTarget = backendUrlOverride || entry?.backendUrl || normalizedBackendUrl;
      const normalizedBackend = normalizeBackendUrlValue(backendTarget);

      const rawMdUrl = typeof directUrlOverride === 'string' ? directUrlOverride : typeof entry?.mdUrl === 'string' ? entry.mdUrl : '';
      const isProxyUrl = rawMdUrl.includes('/api/file?');
      const directUrl = rawMdUrl.startsWith('http') && !isProxyUrl ? rawMdUrl : '';

      if (openInNewTab) {
        if (!directUrl && !normalizedBackend) {
          pushLogs(['❌ Backend non configurato per aprire il testo del PDF.']);
          if (skipEditor) {
            return;
          }
        } else {
          try {
            await openSignedFileInNewTab({
              backendUrl: backendTarget,
              path: mdPathResolved,
              label: 'Testo PDF',
              directUrl,
            });
          } catch (error) {
            const message = error?.message || 'Impossibile aprire il testo del PDF.';
            pushLogs([`❌ ${message}`]);
            return;
          }
        }

        if (skipEditor) {
          return;
        }
      }

      if (!normalizedBackend) {
        const message = 'Configura un backend valido per modificare il PDF.';
        pushLogs([`❌ ${message}`]);
        setErrorBanner({ title: 'Backend non configurato', details: message });
        return;
      }

      const currentPath = location?.pathname || '/library';
      const entrySpeakers = normalizeSpeakers(entry?.speakers);
      const initialSpeakerMap = buildSpeakerMap(entrySpeakers, entry?.speakerMap || {});

      setMdEditor({
        ...EMPTY_EDITOR_STATE,
        open: true,
        entry,
        path: mdPathResolved,
        backendUrl: normalizedBackend,
        loading: true,
        lastAction: 'opening',
        originPath: currentPath === '/editor' ? '/library' : currentPath,
        speakers: entrySpeakers,
        speakerMap: initialSpeakerMap,
        renderedContent: '',
      });
      pushLogs([`✏️ Apertura editor del PDF (${mdPathResolved})`]);

      if (!skipEditor) {
        navigate("/editor");
      }

      try {
        const response = await fetchWithAuth(
          `${normalizedBackend}/api/markdown?path=${encodeURIComponent(mdPathResolved)}`,
          { method: 'GET' }
        );
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }

        if (!response.ok) {
          const message = payload?.message || `Impossibile caricare il testo del PDF (HTTP ${response.status})`;
          throw new Error(message);
        }

        const content = typeof payload?.content === 'string' ? payload.content : '';
        setMdEditor((prev) => {
          if (prev.path !== mdPathResolved) {
            return prev;
          }
          return {
            ...prev,
            loading: false,
            content,
            originalContent: content,
            renderedContent: applySpeakerMappingToContent(content, prev.speakerMap),
            error: '',
            success: '',
            lastAction: 'loaded',
          };
        });
        setHistory((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  mdPath: mdPathResolved,
                  backendUrl: normalizedBackend,
                }
              : item
          )
        );
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        pushLogs([`❌ ${message}`]);
        setMdEditor((prev) => {
          if (prev.path !== mdPathResolved) {
            return prev;
          }
          return {
            ...prev,
            loading: false,
            error: message,
            lastAction: 'error',
          };
        });
      }
    },
    [
      fetchWithAuth,
      location,
      navigate,
      normalizedBackendUrl,
      openSignedFileInNewTab,
      pushLogs,
      setErrorBanner,
      setHistory,
    ]
  );

  const handleOpenMdInNewTab = useCallback(() => {
    if (!mdEditor?.path) {
      return;
    }

    void handleOpenHistoryMd(mdEditor.entry, mdEditor.path, {
      openInNewTab: true,
      skipEditor: true,
      backendUrlOverride: mdEditor.backendUrl,
      directUrlOverride: mdEditor?.entry?.mdUrl || '',
    });
  }, [handleOpenHistoryMd, mdEditor]);

  const handleOpenLibraryFile = useCallback(
    async ({ backendUrl: backendOverride, path, label }) => {
      const resolvedPath = typeof path === 'string' ? path.trim() : '';
      if (!resolvedPath) {
        pushLogs(['❌ Percorso file non disponibile.']);
        return;
      }

      const backendTarget = backendOverride || normalizedBackendUrl;
      if (!normalizeBackendUrlValue(backendTarget)) {
        pushLogs(['❌ Backend non configurato per aprire il file selezionato.']);
        return;
      }

      try {
        await openSignedFileInNewTab({
          backendUrl: backendTarget,
          path: resolvedPath,
          label: label || 'file',
        });
      } catch (error) {
        const message = error?.message || 'Impossibile aprire il file selezionato.';
        pushLogs([`❌ ${message}`]);
      }
    },
    [normalizedBackendUrl, openSignedFileInNewTab, pushLogs]
  );

  const handleRepublishFromMd = useCallback(async (entry, overrideMdPath, options = {}) => {
    const mdPathResolved = overrideMdPath || deriveMarkdownPath(entry?.mdPath, entry?.pdfPath);
    if (!mdPathResolved) {
      pushLogs(['❌ Percorso del testo non disponibile per la rigenerazione.']);
      return;
    }
    if (busy) {
      pushLogs(['⚠️ Attendere il termine della pipeline corrente prima di rigenerare il PDF.']);
      return;
    }

    const backendTarget = entry?.backendUrl || normalizedBackendUrl;
    if (!backendTarget) {
      const message = 'Configura un backend valido per rigenerare il PDF dal testo modificato.';
      pushLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Backend non configurato', details: message });
      return;
    }

    const backendUsed = normalizeBackendUrlValue(backendTarget);
    if (!backendUsed) {
      const message = "Impossibile normalizzare l'URL del backend per PPUBR.";
      pushLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Backend non configurato', details: message });
      return;
    }

    const overrideSpeakerMap = options && typeof options.speakerMap === 'object' ? options.speakerMap : null;
    const speakers = normalizeSpeakers(entry?.speakers);
    const sanitizedSpeakerMap = overrideSpeakerMap
      ? sanitizeSpeakerMapForSubmit(speakers, overrideSpeakerMap)
      : {};
    const hasSpeakerMapPayload = Object.keys(sanitizedSpeakerMap).length > 0;

    revealPipelinePanel();
    setBusy(true);
    setErrorBanner(null);
    setMdEditor((prev) => {
      if (!prev.open || prev.path !== mdPathResolved) {
        return prev;
      }
      return {
        ...prev,
        lastAction: 'republishing',
        success: '',
        error: '',
      };
    });
    pushLogs([`♻️ Rigenerazione PDF dal testo (${entry.title || entry.slug || mdPathResolved})`]);

    try {
      const fd = new FormData();
      fd.append('mdPath', mdPathResolved);
      if (entry?.localPdfPath) {
        fd.append('localPdfPath', entry.localPdfPath);
      }
      if (entry?.localMdPath) {
        fd.append('localMdPath', entry.localMdPath);
      }
      if (isFileLike(customPdfLogo)) {
        const fallbackName = 'custom-logo';
        const fileName =
          typeof customPdfLogo.name === 'string' && customPdfLogo.name.trim()
            ? customPdfLogo.name
            : fallbackName;
        fd.append('pdfLogo', customPdfLogo, fileName);
      } else if (isWorkspaceProfileLogoDescriptor(customPdfLogo)) {
        if (customPdfLogo.profileId && !fd.has('workspaceProfileId')) {
          fd.append('workspaceProfileId', customPdfLogo.profileId);
        }
        if (customPdfLogo.label && !fd.has('workspaceProfileLabel')) {
          fd.append('workspaceProfileLabel', customPdfLogo.label);
        }
        if (customPdfLogo.path && !fd.has('workspaceProfileLogoPath')) {
          fd.append('workspaceProfileLogoPath', customPdfLogo.path);
        }
      }
      appendWorkspaceProfileDetails(fd, {
        selection: workspaceProfileSelection,
        profile: activeWorkspaceProfile,
        logoDescriptor: customPdfLogo,
        backendUrl: normalizeBackendUrlValue(backendUrl),
      });
      if (!workspaceProfileLocked) {
        appendPdfTemplateSelection(fd, pdfTemplateSelection);
      }
      if (hasSpeakerMapPayload) {
        fd.append('speakerMap', JSON.stringify(sanitizedSpeakerMap));
        pushLogs([
          `🗣️ Applicazione mappa speaker (${Object.keys(sanitizedSpeakerMap).length} etichette) durante la rigenerazione`,
        ]);
      }

      const response = await fetchWithAuth(`${backendUsed}/api/ppubr`, {
        method: 'POST',
        body: fd,
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (Array.isArray(payload.logs) && payload.logs.length) {
        pushLogs(payload.logs);
      }

      if (!response.ok || !payload?.pdfPath) {
        const message = payload?.message || `Rigenerazione fallita (HTTP ${response.status || 0})`;
        pushLogs([`❌ ${message}`]);
        setErrorBanner({ title: 'Rigenerazione PDF fallita', details: message });
        setMdEditor((prev) => {
          if (!prev.open || prev.path !== mdPathResolved) {
            return prev;
          }
          return {
            ...prev,
            error: message,
            success: '',
            lastAction: 'error',
          };
        });
        return;
      }

      const pdfUrl = buildFileUrl(backendUsed, payload.pdfPath) || entry.pdfUrl;
      const mdUrl = buildFileUrl(backendUsed, mdPathResolved) || entry.mdUrl;
      const responseSpeakerMapRaw =
        payload?.speakerMap && typeof payload.speakerMap === 'object'
          ? payload.speakerMap
          : sanitizedSpeakerMap;
      const normalizedResponseSpeakerMap = buildSpeakerMap(speakers, responseSpeakerMapRaw);
      const responseHasSpeakerNames = hasNamedSpeakers(normalizedResponseSpeakerMap);

      setPdfPath(payload.pdfPath);
      setMdPath(mdPathResolved);
      const pdfLogoLabel = resolvePdfLogoLabel(customPdfLogo);
      setHistory(prev => prev.map(item => item.id === entry.id ? hydrateHistoryEntry({
        ...item,
        pdfPath: payload.pdfPath,
        pdfUrl,
        mdPath: mdPathResolved,
        mdUrl,
        localPdfPath: payload?.localPdfPath || item.localPdfPath || '',
        localMdPath: payload?.localMdPath || item.localMdPath || '',
        backendUrl: backendUsed || item.backendUrl,
        logs: Array.isArray(item.logs) ? item.logs.concat(payload.logs || []) : (payload.logs || []),
        logos: {
          ...(item.logos || {}),
          pdf: pdfLogoLabel,
        },
        speakerMap: responseHasSpeakerNames
          ? responseSpeakerMapRaw
          : hasSpeakerMapPayload
            ? sanitizedSpeakerMap
            : item.speakerMap || {},
        speakers: speakers.length ? speakers : item.speakers,
      }) : item));

      setMdEditor((prev) => {
        if (!prev.open || prev.path !== mdPathResolved) {
          return prev;
        }
        const fallbackSpeakerMapState = hasSpeakerMapPayload
          ? buildSpeakerMap(prev.speakers, { ...prev.speakerMap, ...sanitizedSpeakerMap })
          : prev.speakerMap;
        const nextSpeakerMapState = responseHasSpeakerNames
          ? normalizedResponseSpeakerMap
          : fallbackSpeakerMapState;
        return {
          ...prev,
          success: 'PDF rigenerato con successo. Usa "Apri PDF aggiornato" per visualizzarlo subito.',
          error: '',
          lastAction: 'republished',
          speakerMap: nextSpeakerMapState,
          renderedContent: applySpeakerMappingToContent(prev.content, nextSpeakerMapState),
          entry: {
            ...(prev.entry || {}),
            pdfPath: payload.pdfPath,
            pdfUrl,
            mdPath: mdPathResolved,
            mdUrl,
            backendUrl: backendUsed || prev.entry?.backendUrl || normalizedBackendUrl,
            localPdfPath: payload?.localPdfPath || prev.entry?.localPdfPath || '',
            localMdPath: payload?.localMdPath || prev.entry?.localMdPath || '',
            speakerMap: responseHasSpeakerNames
              ? responseSpeakerMapRaw
              : hasSpeakerMapPayload
                ? sanitizedSpeakerMap
                : prev.entry?.speakerMap || prev.speakerMap,
            speakers: prev.entry?.speakers || prev.speakers,
          },
        };
      });
      pushLogs([`✅ PDF rigenerato: ${payload.pdfPath}`]);
      setActivePanel('doc');
    } catch (err) {
      const message = err?.message || String(err);
      pushLogs([`❌ ${message}`]);
      setErrorBanner({ title: 'Rigenerazione PDF fallita', details: message });
      setMdEditor((prev) => {
        if (!prev.open || prev.path !== mdPathResolved) {
          return prev;
        }
        return {
          ...prev,
          error: message,
          success: '',
          lastAction: 'error',
        };
      });
    } finally {
      setBusy(false);
    }
  }, [
    activeWorkspaceProfile,
    backendUrl,
    busy,
    customPdfLogo,
    fetchWithAuth,
    normalizedBackendUrl,
    pdfTemplateSelection,
    pushLogs,
    setActivePanel,
    setBusy,
    setErrorBanner,
    setHistory,
    setMdEditor,
    setMdPath,
    setPdfPath,
    workspaceProfileLocked,
    workspaceProfileSelection,
  ]);

  const handleMdEditorChange = useCallback((nextValue) => {
    setMdEditor((prev) => ({
      ...prev,
      content: nextValue,
      renderedContent: applySpeakerMappingToContent(nextValue, prev.speakerMap),
      error: '',
      success: '',
      lastAction: 'editing',
    }));
  }, []);

  const originPath = mdEditor?.originPath;

  const handleMdEditorClose = useCallback(() => {
    const targetPath = originPath && originPath !== '/editor' ? originPath : '/library';

    navigate(targetPath);
    setMdEditor(() => ({ ...EMPTY_EDITOR_STATE }));
  }, [navigate, originPath]);

  const handleSpeakerMapChange = useCallback((nextMap) => {
    setMdEditor((prev) => {
      if (!prev.open) {
        return prev;
      }
      const updatedMap = buildSpeakerMap(prev.speakers, nextMap || {});
      const previousMap = prev.speakerMap || {};
      const sameKeys = Object.keys(updatedMap).length === Object.keys(previousMap).length;
      const isEqual =
        sameKeys && Object.keys(updatedMap).every((key) => (previousMap[key] || '').trim() === (updatedMap[key] || '').trim());
      if (isEqual) {
        return prev;
      }
      return {
        ...prev,
        speakerMap: updatedMap,
        renderedContent: applySpeakerMappingToContent(prev.content, updatedMap),
        lastAction: 'editing-speakers',
        entry: prev.entry ? { ...prev.entry, speakerMap: updatedMap } : prev.entry,
      };
    });
  }, []);

  const handleMdEditorViewPdf = useCallback(async () => {
    const entry = mdEditor?.entry;
    if (!entry?.pdfPath) {
      handleMdEditorClose();
      return;
    }

    const backendForEntry = entry.backendUrl || mdEditor?.backendUrl || normalizedBackendUrl;
    const preparedEntry = {
      ...entry,
      backendUrl: backendForEntry,
    };

    try {
      await handleOpenHistoryPdf(preparedEntry);
    } finally {
      handleMdEditorClose();
    }
  }, [handleMdEditorClose, handleOpenHistoryPdf, mdEditor, normalizedBackendUrl]);

  const handleMdEditorSave = useCallback(async (nextContent) => {
    const targetPath = mdEditor?.path;
    const backendTarget = mdEditor?.backendUrl;
    const entryId = mdEditor?.entry?.id;

    if (!targetPath || !backendTarget) {
      pushLogs(['❌ Nessun backend configurato per salvare le modifiche.']);
      return;
    }

    setMdEditor((prev) => ({
      ...prev,
      saving: true,
      error: '',
      success: '',
      lastAction: 'saving',
    }));
    try {
      const response = await fetchWithAuth(`${backendTarget}/api/markdown`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, content: nextContent }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload?.message || `Salvataggio modifiche fallito (HTTP ${response.status})`;
        throw new Error(message);
      }

      setMdEditor((prev) => {
        if (prev.path !== targetPath) {
          return prev;
        }
        return {
          ...prev,
          saving: false,
          content: nextContent,
          originalContent: nextContent,
          success: 'Modifiche salvate con successo',
          error: '',
          lastAction: 'saved',
        };
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.id === entryId
            ? {
                ...item,
                mdPath: targetPath,
                backendUrl: backendTarget,
                lastEditedAt: new Date().toISOString(),
              }
            : item
        )
      );
      pushLogs([`💾 Modifiche salvate (${targetPath})`]);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      pushLogs([`❌ ${message}`]);
      setMdEditor((prev) => {
        if (prev.path !== targetPath) {
          return prev;
        }
        return {
          ...prev,
          saving: false,
          error: message,
          success: '',
          lastAction: 'error',
        };
      });
    }
  }, [fetchWithAuth, mdEditor, pushLogs, setHistory]);

  const handleRepublishFromEditor = useCallback(() => {
    if (!mdEditor?.entry) return;
    handleRepublishFromMd(mdEditor.entry, mdEditor.path);
  }, [mdEditor, handleRepublishFromMd]);

  const handleRepublishFromEditorWithSpeakers = useCallback(() => {
    if (!mdEditor?.entry) return;
    handleRepublishFromMd(mdEditor.entry, mdEditor.path, { speakerMap: mdEditor.speakerMap });
  }, [mdEditor, handleRepublishFromMd]);

  const handleShowHistoryLogs = useCallback((entry) => {
    if (!entry) return;
    const stageEventsFromHistory = Array.isArray(entry.stageEvents) ? entry.stageEvents : [];
    handlePipelineEvents(stageEventsFromHistory, { animate: false, autoRevealOnFailure: false });
    setLogs(() => {
      const baseLogs = Array.isArray(entry.logs) ? entry.logs : [];
      const extras = [];
      if (entry.backendUrl && entry.backendUrl !== normalizedBackendUrl) {
        extras.push(`ℹ️ PDF creato con backend ${entry.backendUrl}.`);
      }
      extras.push('ℹ️ Log caricati dalla Libreria.');
      return baseLogs.concat(extras);
    });
    if (entry.pdfPath) {
      setPdfPath(entry.pdfPath);
    }
    setMdPath(deriveMarkdownPath(entry.mdPath, entry.pdfPath));
    setActivePanel('doc');
    setErrorBanner(null);
    setShowRawLogs(true);
  }, [normalizedBackendUrl, handlePipelineEvents]);

  const handleRenameHistoryEntry = useCallback((id, title) => {
    setHistory(prev => prev.map(entry => entry.id === id ? { ...entry, title } : entry));
  }, []);

  const handleUpdateHistoryTags = useCallback((id, tags) => {
    setHistory(prev => prev.map(entry => entry.id === id ? { ...entry, tags } : entry));
  }, []);

  const handleDeleteHistoryEntry = useCallback((id) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const destIsPlaceholder=isDestDirPlaceholder(destDir);

  const totalStages = PIPELINE_STAGES.length;
  const stageWeightSum = useMemo(
    () => PIPELINE_STAGES.reduce((acc, stage) => acc + (PIPELINE_STAGE_WEIGHTS[stage.key] ?? 1), 0),
    []
  );
  const completedStagesCount = useMemo(
    () => PIPELINE_STAGES.reduce((acc, stage) => acc + (pipelineStatus[stage.key] === 'done' ? 1 : 0), 0),
    [pipelineStatus]
  );
  const progressPercent = useMemo(() => {
    if (!stageWeightSum) return 0;
    let accumulated = 0;
    PIPELINE_STAGES.forEach((stage) => {
      const weight = PIPELINE_STAGE_WEIGHTS[stage.key] ?? 1;
      const status = pipelineStatus[stage.key];
      if (status === 'done') {
        accumulated += weight;
      } else if (status === 'running') {
        accumulated += weight * 0.35;
      }
    });
    const ratio = Math.min(1, Math.max(0, accumulated / stageWeightSum));
    const percent = Math.round(ratio * 100);
    if (busy && percent < 5) {
      return 5;
    }
    return percent;
  }, [busy, pipelineStatus, stageWeightSum]);
  const failedStage = useMemo(() => PIPELINE_STAGES.find((stage) => pipelineStatus[stage.key] === 'failed'), [pipelineStatus]);
  const pipelineComplete = useMemo(() => totalStages > 0 && PIPELINE_STAGES.every((stage) => pipelineStatus[stage.key] === 'done'), [pipelineStatus, totalStages]);
  const activeStageDefinition = useMemo(() => PIPELINE_STAGES.find((stage) => stage.key === activeStageKey), [activeStageKey]);
  const promptCompletedCues = useMemo(() => {
    if (!promptState?.cueProgress) return [];
    return Object.entries(promptState.cueProgress)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }, [promptState.cueProgress]);
  const activePrompt = useMemo(
    () => findPromptByIdentifier(prompts, promptState.promptId) || null,
    [prompts, promptState.promptId]
  );

  const headerStatus = useMemo(() => {
    if (failedStage) {
      return {
        text: `${failedStage.label}: errore`,
        className: 'border border-rose-500/40 bg-rose-500/10 text-rose-200',
        icon: AlertCircle,
      };
    }
    if (pipelineComplete) {
      return {
        text: 'Pipeline completata',
        className: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        icon: CheckCircle2,
      };
    }
    if (activeStageDefinition) {
      return {
        text: `${activeStageDefinition.label}: in corso`,
        className: 'border border-indigo-500/40 bg-indigo-500/10 text-indigo-100',
        icon: activeStageDefinition.icon,
      };
    }
    if (busy) {
      return {
        text: 'Pipeline in esecuzione…',
        className: 'border border-indigo-500/40 bg-indigo-500/10 text-indigo-100',
        icon: Cpu,
      };
    }
    return {
      text: 'In attesa di avvio',
      className: 'border border-zinc-700 bg-zinc-900 text-zinc-300',
      icon: Cpu,
    };
  }, [failedStage, pipelineComplete, activeStageDefinition, busy]);

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-6 py-4 text-sm text-zinc-300">
          Verifica sessione in corso…
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const baseContextValue = {
    DEFAULT_BACKEND_URL,
    DEFAULT_DEST_DIR,
    theme,
    themes,
    cycleTheme,
    customLogo,
    setCustomLogo,
    customPdfLogo,
    setCustomPdfLogo,
    backendUp,
    backendUrl,
    aiProviderCatalog,
    aiProviderSelection: aiProviderSelectionState,
    setAiProviderSelection,
    resetAiProviderSelection,
    aiProvidersEffective,
    refreshAiProviderCatalog,
    setBackendUrl,
    diagnostics,
    runDiagnostics,
    openSetupAssistant,
    openSettingsDrawer,
    settingsOpen,
    setSettingsOpen,
    activeSettingsSection,
    setActiveSettingsSection,
    showSetupAssistant,
    setShowSetupAssistant,
    shouldShowOnboardingBanner,
    toggleFullScreen,
    session,
    handleLogout,
    onboardingSteps,
    onboardingStep,
    setOnboardingStep,
    handleOnboardingFinish,
    secureOK,
    errorBanner,
    setErrorBanner,
    permissionMessage,
    lastMicError,
    fmtTime,
    fmtBytes,
    elapsed,
    requestPermission,
    permission,
    refreshDevices,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    recording,
    stopRecording,
    startRecording,
    busy,
    mediaSupported,
    recorderSupported,
    level,
    showDestDetails,
    setShowDestDetails,
    destDir,
    setDestDir,
    destIsPlaceholder,
    slug,
    setSlug,
    secondsCap,
    setSecondsCap,
    handleRefreshWorkspaces,
    handleCreateWorkspace,
    handleUpdateWorkspace,
    handleDeleteWorkspace,
    refreshPdfTemplates,
    createWorkspaceProfile,
    updateWorkspaceProfile,
    deleteWorkspaceProfile,
    createWorkspaceProject,
    updateWorkspaceProject,
    deleteWorkspaceProject,
    pdfTemplates,
    pdfTemplatesLoading,
    pdfTemplatesError,
    pdfTemplateSelection,
    handleSelectPdfTemplate,
    clearPdfTemplateSelection,
    resetInputSelections,
    workspaceLoading,
    handleSelectWorkspaceForPipeline,
    workspaceSelection,
    workspaceProfileSelection,
    workspaceProfileLocked,
    activeWorkspaceProfiles,
    activeWorkspaceProfile,
    applyWorkspaceProfile,
    clearWorkspaceProfile,
    workspaces,
    activeWorkspace,
    DEFAULT_WORKSPACE_STATUSES,
    projectCreationMode,
    workspaceProjects,
    handleSelectProjectForPipeline,
    projectDraft,
    setProjectDraft,
    handleCreateProjectFromDraft,
    statusCreationMode,
    statusDraft,
    setStatusDraft,
    handleCreateStatusFromDraft,
    availableStatuses,
    handleSelectStatusForPipeline,
    prompts,
    promptLoading,
    promptState,
    refinedData,
    setRefinedData,
    handleSelectPromptTemplate,
    handleClearPromptSelection,
    promptFavorites,
    handleTogglePromptFavorite,
    handleRefreshPrompts,
    activePrompt,
    handlePromptFocusChange,
    handlePromptNotesChange,
    handleTogglePromptCue,
    setCueCardAnswers,
    setPromptFocus,
    setPromptNotes,
    setPromptDetailsOpen,
    handleCreatePrompt,
    handleDeletePrompt,
    mime,
    audioBlob,
    audioUrl,
    enableDiarization,
    setEnableDiarization,
    processViaBackend,
    resetAll,
    fileInputRef,
    onPickFile,
    markdownInputRef,
    handleMarkdownFilePicked,
    lastMarkdownUpload,
    textInputRef,
    handleTextFilePicked,
    lastTextUpload,
    showRawLogs,
    setShowRawLogs,
    PIPELINE_STAGES,
    pipelineStatus,
    stageMessages,
    STAGE_STATUS_STYLES,
    STAGE_STATUS_LABELS,
    failedStage,
    activeStageKey,
    progressPercent,
    completedStagesCount,
    totalStages,
    logs,
    onboardingComplete,
    HISTORY_TABS,
    historyTab,
    setHistoryTab,
    history,
    navigatorSelection,
    setNavigatorSelection,
    savedWorkspaceFilters,
    handleSaveWorkspaceFilter,
    handleDeleteWorkspaceFilter,
    handleApplyWorkspaceFilter,
    historyFilter,
    setHistoryFilter,
    fetchEntryPreview,
    fetchEntryPreAnalysis,
    handleOpenHistoryPdf,
    handleOpenHistoryMd,
    handleRepublishFromMd,
    handleShowHistoryLogs,
    handleAssignEntryWorkspace,
    handleAdoptNavigatorSelection,
    normalizedBackendUrl,
    fetchBody,
    handleLibraryWorkspaceSelection,
    handleOpenLibraryFile,
    mdEditor,
    handleMdEditorChange,
    handleMdEditorClose,
    handleMdEditorSave,
    handleRepublishFromEditor,
    handleSpeakerMapChange,
    handleRepublishFromEditorWithSpeakers,
    mdEditorDirty,
    speakerMapHasNames,
    handleOpenMdInNewTab,
    handleMdEditorViewPdf,
    headerStatus,
    promptCompletedCues,
    baseJourneyVisibility,
    revealPublishPanel,
    revealPipelinePanel,
    openRefinementPanel,
    closeRefinementPanel,
    resetJourneyVisibility,
    resetCreationFlowState,
    pipelineComplete,
    resetDiarizationPreference,
  };

  return (
    <ModeProvider session={session} syncWithSupabase={!BYPASS_AUTH}>
      <PromptsProvider prompts={prompts}>
        <AppContextComposer baseValue={baseContextValue}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/create" replace />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/advanced" element={<AdvancedPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="*" element={<Navigate to="/create" replace />} />
            </Route>
          </Routes>
        </AppContextComposer>
      </PromptsProvider>
    </ModeProvider>
  );
}

export { appendWorkspaceProfileDetails };
export default AppContent;
