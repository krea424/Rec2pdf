const DEFAULT_WORKSPACE_COLOR = "#6366f1";
export const DEFAULT_WORKSPACE_STATUSES = [
  "Bozza",
  "In lavorazione",
  "Da revisionare",
  "Completato",
];

const toArray = (value) => (Array.isArray(value) ? value : []);

const parseTimestamp = (value) => {
  if (!value) {
    return { iso: null, ms: null };
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? { iso: null, ms: null } : { iso: value.toISOString(), ms: time };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? { iso: null, ms: null } : { iso: date.toISOString(), ms: time };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { iso: null, ms: null };
    }
    const date = new Date(trimmed);
    const time = date.getTime();
    return Number.isNaN(time) ? { iso: null, ms: null } : { iso: date.toISOString(), ms: time };
  }
  return { iso: null, ms: null };
};

const sanitizeColor = (value, fallback = DEFAULT_WORKSPACE_COLOR) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return fallback;
};

const sanitizeDestDir = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/\\+/g, "/");
  if (!normalized || /tuo_utente/i.test(normalized)) {
    return "";
  }
  if (normalized === "/Users/" || normalized === "/Users") {
    return "";
  }
  if (normalized.toLowerCase() === "users/" || normalized.toLowerCase() === "users") {
    return "";
  }
  return trimmed;
};

const sanitizeStatusList = (value, fallback = DEFAULT_WORKSPACE_STATUSES) => {
  const statuses = toArray(value)
    .map((status) => {
      if (typeof status === "string") {
        return status.trim();
      }
      if (status && typeof status === "object" && typeof status.label === "string") {
        return status.label.trim();
      }
      return String(status || "").trim();
    })
    .filter(Boolean);
  if (statuses.length) {
    return statuses;
  }
  return Array.isArray(fallback) && fallback.length ? [...fallback] : [...DEFAULT_WORKSPACE_STATUSES];
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.projects)) {
        return parsed.projects;
      }
      return [];
    } catch (error) {
      console.warn("Impossibile effettuare il parse del campo JSON", error);
      return [];
    }
  }
  if (typeof value === "object") {
    if (Array.isArray(value.projects)) {
      return value.projects;
    }
    return Object.values(value);
  }
  return [];
};

const parseProjects = (value, { fallbackColor, fallbackStatuses } = {}) => {
  const rawList = parseJsonArray(value);
  const normalizedFallbackStatuses = Array.isArray(fallbackStatuses) && fallbackStatuses.length
    ? fallbackStatuses
    : DEFAULT_WORKSPACE_STATUSES;

  return rawList
    .map((project, index) => {
      if (!project || typeof project !== "object") {
        return null;
      }
      const { iso: createdAtIso, ms: createdAtMs } = parseTimestamp(project.createdAt ?? project.created_at);
      const { iso: updatedAtIso, ms: updatedAtMs } = parseTimestamp(project.updatedAt ?? project.updated_at);
      const idSource =
        typeof project.id === "string" && project.id.trim()
          ? project.id.trim()
          : typeof project.slug === "string" && project.slug.trim()
          ? project.slug.trim()
          : project.key || `proj_${index}`;
      const nameSource =
        typeof project.name === "string" && project.name.trim()
          ? project.name.trim()
          : typeof project.label === "string" && project.label.trim()
          ? project.label.trim()
          : idSource;
      const color = sanitizeColor(project.color, fallbackColor || DEFAULT_WORKSPACE_COLOR);
      const statuses = sanitizeStatusList(project.statuses, normalizedFallbackStatuses);
      const destDir = sanitizeDestDir(project.destDir ?? project.dest_dir ?? "");

      return {
        id: idSource,
        name: nameSource,
        color,
        destDir,
        statuses,
        createdAt: createdAtMs || null,
        createdAtIso,
        updatedAt: updatedAtMs || createdAtMs || null,
        updatedAtIso: updatedAtIso || createdAtIso,
      };
    })
    .filter(Boolean);
};

const normalizeVersioningPolicy = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const retentionRaw = value.retentionLimit ?? value.retention_limit;
  const freezeRaw = value.freezeOnPublish ?? value.freeze_on_publish;
  const namingRaw = value.namingConvention ?? value.naming_convention;

  const retentionLimit = Number.isFinite(Number(retentionRaw)) && Number(retentionRaw) > 0
    ? Math.round(Number(retentionRaw))
    : null;

  const freezeOnPublish = (() => {
    if (typeof freezeRaw === "boolean") {
      return freezeRaw;
    }
    if (typeof freezeRaw === "string") {
      const normalized = freezeRaw.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
        return true;
      }
      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
        return false;
      }
    }
    if (typeof freezeRaw === "number") {
      return freezeRaw !== 0;
    }
    return null;
  })();

  const namingConvention = typeof namingRaw === "string" && namingRaw.trim() ? namingRaw.trim() : "";

  if (retentionLimit === null && freezeOnPublish === null && !namingConvention) {
    return null;
  }

  return {
    retentionLimit: retentionLimit ?? 10,
    freezeOnPublish: freezeOnPublish ?? false,
    namingConvention: namingConvention || "timestamped",
  };
};

export const normalizeWorkspaceRecord = (workspace) => {
  if (!workspace || typeof workspace !== "object") {
    return null;
  }

  const metadata = workspace.metadata && typeof workspace.metadata === "object" ? workspace.metadata : {};
  const id =
    typeof workspace.id === "string" && workspace.id.trim()
      ? workspace.id.trim()
      : typeof workspace.workspace_id === "string" && workspace.workspace_id.trim()
      ? workspace.workspace_id.trim()
      : "";

  if (!id) {
    return null;
  }

  const nameSource =
    typeof workspace.name === "string" && workspace.name.trim()
      ? workspace.name.trim()
      : typeof metadata.name === "string" && metadata.name.trim()
      ? metadata.name.trim()
      : typeof metadata.client === "string" && metadata.client.trim()
      ? metadata.client.trim()
      : id;

  const clientSource =
    typeof workspace.client === "string" && workspace.client.trim()
      ? workspace.client.trim()
      : typeof metadata.client === "string" && metadata.client.trim()
      ? metadata.client.trim()
      : nameSource;

  const destDir = sanitizeDestDir(
    workspace.destDir ?? workspace.dest_dir ?? metadata.destDir ?? metadata.dest_dir ?? "",
  );

  const defaultStatuses = sanitizeStatusList(
    workspace.defaultStatuses ?? workspace.default_statuses ?? metadata.defaultStatuses,
    DEFAULT_WORKSPACE_STATUSES,
  );

  const color = sanitizeColor(workspace.color ?? metadata.color ?? "", DEFAULT_WORKSPACE_COLOR);

  const projects = parseProjects(workspace.projects ?? metadata.projects ?? [], {
    fallbackColor: color,
    fallbackStatuses: defaultStatuses,
  });

  const profiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];

  const { iso: createdAtIso, ms: createdAtMs } = parseTimestamp(workspace.createdAt ?? workspace.created_at);
  const { iso: updatedAtIso, ms: updatedAtMs } = parseTimestamp(workspace.updatedAt ?? workspace.updated_at);

  const versioningPolicy = normalizeVersioningPolicy(
    workspace.versioningPolicy ?? metadata.versioningPolicy ?? null,
  );

  const logoPath = (() => {
    if (typeof workspace.logoPath === "string" && workspace.logoPath.trim()) {
      return workspace.logoPath.trim();
    }
    if (typeof workspace.logo_path === "string" && workspace.logo_path.trim()) {
      return workspace.logo_path.trim();
    }
    if (typeof metadata.logoPath === "string" && metadata.logoPath.trim()) {
      return metadata.logoPath.trim();
    }
    return "";
  })();

  const normalized = {
    ...workspace,
    id,
    name: nameSource,
    client: clientSource,
    color,
    destDir,
    metadata,
    logoPath,
    defaultStatuses,
    projects,
    profiles,
    versioningPolicy,
    createdAt: createdAtMs || null,
    createdAtIso,
    updatedAt: updatedAtMs || createdAtMs || null,
    updatedAtIso: updatedAtIso || createdAtIso,
  };

  if (Object.prototype.hasOwnProperty.call(normalized, "default_statuses")) {
    delete normalized.default_statuses;
  }

  return normalized;
};

export const parseWorkspacesResponse = (payload) => {
  const source = payload && typeof payload === "object" ? payload.workspaces : null;
  const list = Array.isArray(source) ? source : [];
  const workspaces = list.map((item) => normalizeWorkspaceRecord(item)).filter(Boolean);
  return { workspaces };
};

export const parseWorkspaceResponse = (payload) => {
  const source = payload && typeof payload === "object" ? payload.workspace || payload : null;
  const workspace = normalizeWorkspaceRecord(source);
  return { workspace };
};
