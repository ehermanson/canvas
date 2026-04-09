import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = unknown>(): Promise<T>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<unknown>;
  prepare(query: string): D1PreparedStatement;
}

export interface CanvasAuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

interface StoredLayoutRow {
  created_at: number;
  id: string;
  title: string;
  updated_at: number;
  url: string;
}

interface StoredPlannerProjectRow {
  active_snapshot_id: string;
  created_at: string;
  id: string;
  name: string;
  updated_at: string;
}

interface StoredPlannerSnapshotRow {
  created_at: string;
  id: string;
  name: string;
  project_id: string;
  state_json: string;
  updated_at: string;
}

export interface AuthSession {
  session: {
    id: string;
    userId: string;
  };
  user: {
    email: string;
    id: string;
    image?: string | null;
    name: string;
  };
}

export interface SavedLayoutRecord {
  createdAt: number;
  id: string;
  title: string;
  updatedAt: number;
  url: string;
}

export interface PlannerSnapshotRecord {
  createdAt: string;
  id: string;
  name: string;
  state: unknown;
  updatedAt: string;
}

export interface PlannerProjectRecord {
  activeSnapshotId: string;
  createdAt: string;
  id: string;
  name: string;
  snapshots: PlannerSnapshotRecord[];
  updatedAt: string;
}

export interface CreateLayoutInput {
  title: string;
  url: string;
}

export interface UpdateLayoutInput {
  title?: string;
  url?: string;
}

export interface CreatePlannerProjectInput {
  activeSnapshotId?: string;
  name: string;
  snapshots?: Array<{
    id?: string;
    name: string;
    state: unknown;
  }>;
}

export interface UpdatePlannerProjectInput {
  activeSnapshotId?: string;
  name?: string;
}

export interface CreatePlannerSnapshotInput {
  id?: string;
  name: string;
  state: unknown;
}

export interface UpdatePlannerSnapshotInput {
  name?: string;
  state?: unknown;
}

export interface SyncPlannerProjectsInput {
  activeProjectId: string;
  projects: PlannerProjectRecord[];
}

export interface ImportLayoutsInput {
  layouts: SavedLayoutRecord[];
}

export interface ImportPlannerProjectsInput {
  projects: PlannerProjectRecord[];
}

const appMigrations = [
  `CREATE TABLE IF NOT EXISTS layouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS layouts_user_id_idx ON layouts(user_id)",
  "CREATE INDEX IF NOT EXISTS layouts_updated_at_idx ON layouts(user_id, updated_at DESC)",
  `CREATE TABLE IF NOT EXISTS planner_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    active_snapshot_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS planner_projects_user_id_idx ON planner_projects(user_id)",
  "CREATE INDEX IF NOT EXISTS planner_projects_updated_at_idx ON planner_projects(user_id, updated_at DESC)",
  `CREATE TABLE IF NOT EXISTS planner_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES planner_projects(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS planner_snapshots_project_id_idx ON planner_snapshots(project_id)",
];

const databaseReady = new WeakMap<D1Database, Promise<void>>();
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const MAX_IMPORT_LAYOUTS = 250;
const MAX_IMPORT_PROJECTS = 50;
const MAX_PROJECT_SNAPSHOTS = 200;
const MAX_TEXT_FIELD_LENGTH = 500;
const MAX_LAYOUT_URL_LENGTH = 16_384;

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function error(message: string, status: number) {
  return json({ error: message }, { status });
}

class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestValidationError";
    this.status = status;
  }
}

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new RequestValidationError(message);
  }
}

function assertNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequestValidationError(`${field} is required`);
  }

  if (value.trim().length > MAX_TEXT_FIELD_LENGTH) {
    throw new RequestValidationError(`${field} is too long`);
  }
}

function assertOptionalString(value: unknown, field: string) {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    throw new RequestValidationError(`${field} must be a string`);
  }

  if (value.trim().length === 0) {
    throw new RequestValidationError(`${field} cannot be empty`);
  }

  if (value.trim().length > MAX_TEXT_FIELD_LENGTH) {
    throw new RequestValidationError(`${field} is too long`);
  }
}

function assertNonEmptyLayoutUrl(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequestValidationError(`${field} is required`);
  }

  if (value.trim().length > MAX_LAYOUT_URL_LENGTH) {
    throw new RequestValidationError(`${field} is too long`);
  }
}

function assertOptionalLayoutUrl(value: unknown, field: string) {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    throw new RequestValidationError(`${field} must be a string`);
  }

  if (value.trim().length === 0) {
    throw new RequestValidationError(`${field} cannot be empty`);
  }

  if (value.trim().length > MAX_LAYOUT_URL_LENGTH) {
    throw new RequestValidationError(`${field} is too long`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string") {
    throw new RequestValidationError(`${field} must be a string`);
  }
}

function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RequestValidationError(`${field} must be a number`);
  }
}

function assertArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new RequestValidationError(`${field} must be an array`);
  }
}

function validateSavedLayoutRecord(
  value: unknown,
  field = "layout",
): asserts value is SavedLayoutRecord {
  assertRecord(value, `${field} must be an object`);
  assertString(value.id, `${field}.id`);
  assertNonEmptyString(value.title, `${field}.title`);
  assertNonEmptyLayoutUrl(value.url, `${field}.url`);
  assertNumber(value.createdAt, `${field}.createdAt`);
  assertNumber(value.updatedAt, `${field}.updatedAt`);
}

function validatePlannerSnapshotRecord(
  value: unknown,
  field = "snapshot",
): asserts value is PlannerSnapshotRecord {
  assertRecord(value, `${field} must be an object`);
  assertString(value.id, `${field}.id`);
  assertNonEmptyString(value.name, `${field}.name`);
  assertString(value.createdAt, `${field}.createdAt`);
  assertString(value.updatedAt, `${field}.updatedAt`);
}

function validatePlannerProjectRecord(
  value: unknown,
  field = "project",
): asserts value is PlannerProjectRecord {
  assertRecord(value, `${field} must be an object`);
  assertString(value.id, `${field}.id`);
  assertNonEmptyString(value.name, `${field}.name`);
  assertString(value.activeSnapshotId, `${field}.activeSnapshotId`);
  assertString(value.createdAt, `${field}.createdAt`);
  assertString(value.updatedAt, `${field}.updatedAt`);
  const snapshots = value.snapshots;
  assertArray(snapshots, `${field}.snapshots`);

  if (snapshots.length === 0) {
    throw new RequestValidationError(`${field}.snapshots must not be empty`);
  }

  if (snapshots.length > MAX_PROJECT_SNAPSHOTS) {
    throw new RequestValidationError(`${field}.snapshots exceeds the allowed limit`);
  }

  snapshots.forEach((snapshot, index) => {
    validatePlannerSnapshotRecord(snapshot, `${field}.snapshots[${index}]`);
  });
}

function validateCreateLayoutInput(value: unknown): asserts value is CreateLayoutInput {
  assertRecord(value, "Layout payload must be an object");
  assertNonEmptyString(value.title, "title");
  assertNonEmptyLayoutUrl(value.url, "url");
}

function validateUpdateLayoutInput(value: unknown): asserts value is UpdateLayoutInput {
  assertRecord(value, "Layout payload must be an object");

  if (value.title === undefined && value.url === undefined) {
    throw new RequestValidationError("At least one layout field is required");
  }

  assertOptionalString(value.title, "title");
  assertOptionalLayoutUrl(value.url, "url");
}

function validateCreatePlannerProjectInput(
  value: unknown,
): asserts value is CreatePlannerProjectInput {
  assertRecord(value, "Project payload must be an object");
  assertNonEmptyString(value.name, "name");

  if (value.activeSnapshotId !== undefined) {
    assertString(value.activeSnapshotId, "activeSnapshotId");
  }

  if (value.snapshots !== undefined) {
    const snapshots = value.snapshots;
    assertArray(snapshots, "snapshots");

    if (snapshots.length === 0) {
      throw new RequestValidationError("snapshots must not be empty");
    }

    if (snapshots.length > MAX_PROJECT_SNAPSHOTS) {
      throw new RequestValidationError("snapshots exceeds the allowed limit");
    }

    snapshots.forEach((snapshot, index) => {
      assertRecord(snapshot, `snapshots[${index}] must be an object`);
      if (snapshot.id !== undefined) {
        assertString(snapshot.id, `snapshots[${index}].id`);
      }
      assertNonEmptyString(snapshot.name, `snapshots[${index}].name`);
    });
  }
}

function validateUpdatePlannerProjectInput(
  value: unknown,
): asserts value is UpdatePlannerProjectInput {
  assertRecord(value, "Project payload must be an object");

  if (value.name === undefined && value.activeSnapshotId === undefined) {
    throw new RequestValidationError("At least one project field is required");
  }

  assertOptionalString(value.name, "name");
  if (value.activeSnapshotId !== undefined) {
    assertString(value.activeSnapshotId, "activeSnapshotId");
  }
}

function validateCreatePlannerSnapshotInput(
  value: unknown,
): asserts value is CreatePlannerSnapshotInput {
  assertRecord(value, "Snapshot payload must be an object");
  if (value.id !== undefined) {
    assertString(value.id, "id");
  }
  assertNonEmptyString(value.name, "name");
}

function validateUpdatePlannerSnapshotInput(
  value: unknown,
): asserts value is UpdatePlannerSnapshotInput {
  assertRecord(value, "Snapshot payload must be an object");

  if (value.name === undefined && value.state === undefined) {
    throw new RequestValidationError("At least one snapshot field is required");
  }

  assertOptionalString(value.name, "name");
}

function validateImportLayoutsInput(value: unknown): asserts value is ImportLayoutsInput {
  assertRecord(value, "Import payload must be an object");
  const layouts = value.layouts;
  assertArray(layouts, "layouts");

  if (layouts.length > MAX_IMPORT_LAYOUTS) {
    throw new RequestValidationError("layouts exceeds the allowed import limit");
  }

  layouts.forEach((layout, index) => {
    validateSavedLayoutRecord(layout, `layouts[${index}]`);
  });
}

function validateImportPlannerProjectsInput(
  value: unknown,
): asserts value is ImportPlannerProjectsInput {
  assertRecord(value, "Import payload must be an object");
  const projects = value.projects;
  assertArray(projects, "projects");

  if (projects.length > MAX_IMPORT_PROJECTS) {
    throw new RequestValidationError("projects exceeds the allowed import limit");
  }

  projects.forEach((project, index) => {
    validatePlannerProjectRecord(project, `projects[${index}]`);
  });
}

function validateSyncPlannerProjectsInput(
  value: unknown,
): asserts value is SyncPlannerProjectsInput {
  assertRecord(value, "Sync payload must be an object");
  assertString(value.activeProjectId, "activeProjectId");
  const projects = value.projects;
  assertArray(projects, "projects");

  if (projects.length > MAX_IMPORT_PROJECTS) {
    throw new RequestValidationError("projects exceeds the allowed sync limit");
  }

  projects.forEach((project, index) => {
    validatePlannerProjectRecord(project, `projects[${index}]`);
  });
}

function getAuthSecret(env: CanvasAuthEnv) {
  return env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me";
}

async function runStatements(database: D1Database, statements: string[]) {
  for (const statement of statements) {
    await database.prepare(statement).run();
  }
}

function getGoogleProviderConfig(env: CanvasAuthEnv) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return {};
  }

  return {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account" as const,
    },
  };
}

export function createCanvasAuth(request: Request, env: CanvasAuthEnv) {
  const parsed = new URL(request.url);

  // Cloudflare Workers may receive http:// in request.url even behind HTTPS.
  // Force https for non-localhost origins so OAuth redirect URIs are correct.
  if (parsed.hostname !== "localhost" && parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }

  let origin = normalizeOrigin(parsed.origin);

  // In local dev the Vite proxy forwards browser requests to the Wrangler Worker,
  // but Wrangler may derive request.url from the production custom-domain route.
  // Detect localhost from Origin header (POST requests) or Host header (GET
  // requests like OAuth callbacks) and use it as baseURL so the OAuth
  // redirect_uri stays on localhost throughout the entire flow.
  const requestOrigin = request.headers.get("origin");
  const hostHeader = request.headers.get("host");
  if (requestOrigin) {
    const reqOriginUrl = new URL(requestOrigin);
    if (reqOriginUrl.hostname === "localhost") {
      origin = normalizeOrigin(requestOrigin);
    }
  } else if (hostHeader) {
    // GET requests (like OAuth callbacks) don't have an Origin header.
    // The Host header preserves the browser-facing host:port when the Vite
    // proxy does not use changeOrigin.
    const hostUrl = new URL(`http://${hostHeader}`);
    if (hostUrl.hostname === "localhost") {
      origin = normalizeOrigin(hostUrl.origin);
    }
  }

  // Build a trusted origins list that covers the Worker-derived origin, the
  // browser Origin header, and the Host header.  In local dev these can all
  // differ (e.g. Wrangler production domain vs Vite port vs Wrangler port).
  const trusted = [origin];
  const parsedOrigin = normalizeOrigin(parsed.origin);
  if (!trusted.includes(parsedOrigin)) {
    trusted.push(parsedOrigin);
  }
  if (requestOrigin) {
    const normalized = normalizeOrigin(requestOrigin);
    if (!trusted.includes(normalized)) {
      trusted.push(normalized);
    }
  }
  if (hostHeader) {
    const hostOrigin = normalizeOrigin(new URL(`http://${hostHeader}`).origin);
    if (!trusted.includes(hostOrigin)) {
      trusted.push(hostOrigin);
    }
  }

  return betterAuth({
    baseURL: origin,
    database: env.DB,
    secret: getAuthSecret(env),
    account: {
      storeStateStrategy: "database",
      skipStateCookieCheck: true,
    },
    socialProviders: getGoogleProviderConfig(env),
    trustedOrigins: trusted,
  });
}

export async function ensureCanvasDatabaseReady(request: Request, env: CanvasAuthEnv) {
  const existing = databaseReady.get(env.DB);
  if (existing) {
    await existing;
    return;
  }

  const migrationPromise = (async () => {
    const auth = createCanvasAuth(request, env);
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    await runStatements(env.DB, appMigrations);
  })();

  databaseReady.set(env.DB, migrationPromise);
  await migrationPromise;
}

export async function requireSession(request: Request, env: CanvasAuthEnv) {
  await ensureCanvasDatabaseReady(request, env);
  const auth = createCanvasAuth(request, env);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return null;
  }

  return session as AuthSession;
}

export async function handleAuthRequest(request: Request, env: CanvasAuthEnv) {
  await ensureCanvasDatabaseReady(request, env);
  return createCanvasAuth(request, env).handler(request);
}

export async function handleSessionRequest(request: Request, env: CanvasAuthEnv) {
  const session = await requireSession(request, env);
  return json({ session });
}

function mapLayout(row: StoredLayoutRow): SavedLayoutRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    url: row.url,
  };
}

async function getLayoutsForUser(env: CanvasAuthEnv, userId: string) {
  const result = await env.DB.prepare(
    `
      SELECT id, title, url, created_at, updated_at
      FROM layouts
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `,
  )
    .bind(userId)
    .all<StoredLayoutRow>();

  return result.results.map(mapLayout);
}

async function createLayout(env: CanvasAuthEnv, userId: string, input: CreateLayoutInput) {
  const now = Date.now();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `
      INSERT INTO layouts (id, user_id, title, url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(id, userId, input.title.trim(), input.url, now, now)
    .run();

  return {
    createdAt: now,
    id,
    title: input.title.trim(),
    updatedAt: now,
    url: input.url,
  } satisfies SavedLayoutRecord;
}

async function updateLayout(
  env: CanvasAuthEnv,
  userId: string,
  layoutId: string,
  input: UpdateLayoutInput,
) {
  const current = await env.DB.prepare(
    `
      SELECT id, title, url, created_at, updated_at
      FROM layouts
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(layoutId, userId)
    .first<StoredLayoutRow>();

  if (!current) {
    return null;
  }

  const updatedAt = Date.now();
  const title = input.title?.trim() || current.title;
  const url = input.url ?? current.url;

  await env.DB.prepare(
    `
      UPDATE layouts
      SET title = ?, url = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(title, url, updatedAt, layoutId, userId)
    .run();

  return {
    createdAt: current.created_at,
    id: current.id,
    title,
    updatedAt,
    url,
  } satisfies SavedLayoutRecord;
}

async function deleteLayout(env: CanvasAuthEnv, userId: string, layoutId: string) {
  await env.DB.prepare(
    `
      DELETE FROM layouts
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(layoutId, userId)
    .run();
}

function mapPlannerProjectRows(
  projects: StoredPlannerProjectRow[],
  snapshots: StoredPlannerSnapshotRow[],
): PlannerProjectRecord[] {
  return projects.map((project) => ({
    activeSnapshotId: project.active_snapshot_id,
    createdAt: project.created_at,
    id: project.id,
    name: project.name,
    snapshots: snapshots
      .filter((snapshot) => snapshot.project_id === project.id)
      .map((snapshot) => ({
        createdAt: snapshot.created_at,
        id: snapshot.id,
        name: snapshot.name,
        state: JSON.parse(snapshot.state_json),
        updatedAt: snapshot.updated_at,
      })),
    updatedAt: project.updated_at,
  }));
}

async function getPlannerProjectsForUser(env: CanvasAuthEnv, userId: string) {
  const projectsResult = await env.DB.prepare(
    `
      SELECT id, name, active_snapshot_id, created_at, updated_at
      FROM planner_projects
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `,
  )
    .bind(userId)
    .all<StoredPlannerProjectRow>();

  const snapshotsResult = await env.DB.prepare(
    `
      SELECT s.id, s.project_id, s.name, s.state_json, s.created_at, s.updated_at
      FROM planner_snapshots s
      INNER JOIN planner_projects p ON p.id = s.project_id
      WHERE p.user_id = ?
      ORDER BY s.created_at ASC
    `,
  )
    .bind(userId)
    .all<StoredPlannerSnapshotRow>();

  return mapPlannerProjectRows(projectsResult.results, snapshotsResult.results);
}

async function createPlannerProject(
  env: CanvasAuthEnv,
  userId: string,
  input: CreatePlannerProjectInput,
) {
  const projectId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const snapshots =
    input.snapshots && input.snapshots.length > 0
      ? input.snapshots.map((snapshot) => ({
          id: snapshot.id ?? crypto.randomUUID(),
          name: snapshot.name,
          state: snapshot.state,
        }))
      : [
          {
            id: crypto.randomUUID(),
            name: "Current Layout",
            state: {},
          },
        ];
  const activeSnapshotId = input.activeSnapshotId ?? snapshots[0].id;

  await env.DB.prepare(
    `
      INSERT INTO planner_projects (id, user_id, name, active_snapshot_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(projectId, userId, input.name.trim(), activeSnapshotId, timestamp, timestamp)
    .run();

  for (const snapshot of snapshots) {
    await env.DB.prepare(
      `
        INSERT INTO planner_snapshots (id, project_id, name, state_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        snapshot.id,
        projectId,
        snapshot.name,
        JSON.stringify(snapshot.state),
        timestamp,
        timestamp,
      )
      .run();
  }

  return {
    activeSnapshotId,
    createdAt: timestamp,
    id: projectId,
    name: input.name.trim(),
    snapshots: snapshots.map((snapshot) => ({
      createdAt: timestamp,
      id: snapshot.id,
      name: snapshot.name,
      state: snapshot.state,
      updatedAt: timestamp,
    })),
    updatedAt: timestamp,
  } satisfies PlannerProjectRecord;
}

async function updatePlannerProject(
  env: CanvasAuthEnv,
  userId: string,
  projectId: string,
  input: UpdatePlannerProjectInput,
) {
  const current = await env.DB.prepare(
    `
      SELECT id, name, active_snapshot_id, created_at, updated_at
      FROM planner_projects
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(projectId, userId)
    .first<StoredPlannerProjectRow>();

  if (!current) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const name = input.name?.trim() || current.name;
  const activeSnapshotId = input.activeSnapshotId ?? current.active_snapshot_id;

  await env.DB.prepare(
    `
      UPDATE planner_projects
      SET name = ?, active_snapshot_id = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(name, activeSnapshotId, updatedAt, projectId, userId)
    .run();

  const projects = await getPlannerProjectsForUser(env, userId);
  return projects.find((project) => project.id === projectId) ?? null;
}

async function deletePlannerProject(env: CanvasAuthEnv, userId: string, projectId: string) {
  await env.DB.prepare(
    `
      DELETE FROM planner_projects
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(projectId, userId)
    .run();
}

async function createPlannerSnapshot(
  env: CanvasAuthEnv,
  userId: string,
  projectId: string,
  input: CreatePlannerSnapshotInput,
) {
  const project = await env.DB.prepare(
    `
      SELECT id
      FROM planner_projects
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(projectId, userId)
    .first<{ id: string }>();

  if (!project) {
    return null;
  }

  const id = input.id ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await env.DB.prepare(
    `
      INSERT INTO planner_snapshots (id, project_id, name, state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(id, projectId, input.name.trim(), JSON.stringify(input.state), timestamp, timestamp)
    .run();

  return {
    createdAt: timestamp,
    id,
    name: input.name.trim(),
    state: input.state,
    updatedAt: timestamp,
  } satisfies PlannerSnapshotRecord;
}

async function updatePlannerSnapshot(
  env: CanvasAuthEnv,
  userId: string,
  projectId: string,
  snapshotId: string,
  input: UpdatePlannerSnapshotInput,
) {
  const current = await env.DB.prepare(
    `
      SELECT s.id, s.project_id, s.name, s.state_json, s.created_at, s.updated_at
      FROM planner_snapshots s
      INNER JOIN planner_projects p ON p.id = s.project_id
      WHERE s.id = ? AND s.project_id = ? AND p.user_id = ?
    `,
  )
    .bind(snapshotId, projectId, userId)
    .first<StoredPlannerSnapshotRow>();

  if (!current) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const name = input.name?.trim() || current.name;
  const state = input.state ?? JSON.parse(current.state_json);

  await env.DB.prepare(
    `
      UPDATE planner_snapshots
      SET name = ?, state_json = ?, updated_at = ?
      WHERE id = ? AND project_id = ?
    `,
  )
    .bind(name, JSON.stringify(state), updatedAt, snapshotId, projectId)
    .run();

  return {
    createdAt: current.created_at,
    id: current.id,
    name,
    state,
    updatedAt,
  } satisfies PlannerSnapshotRecord;
}

async function deletePlannerSnapshot(
  env: CanvasAuthEnv,
  userId: string,
  projectId: string,
  snapshotId: string,
) {
  const project = await env.DB.prepare(
    `
      SELECT active_snapshot_id
      FROM planner_projects
      WHERE id = ? AND user_id = ?
    `,
  )
    .bind(projectId, userId)
    .first<{ active_snapshot_id: string }>();

  if (!project) {
    return false;
  }

  await env.DB.prepare(
    `
      DELETE FROM planner_snapshots
      WHERE id = ? AND project_id = ?
    `,
  )
    .bind(snapshotId, projectId)
    .run();

  if (project.active_snapshot_id === snapshotId) {
    const replacement = await env.DB.prepare(
      `
        SELECT id
        FROM planner_snapshots
        WHERE project_id = ?
        ORDER BY created_at ASC
        LIMIT 1
      `,
    )
      .bind(projectId)
      .first<{ id: string }>();

    await env.DB.prepare(
      `
        UPDATE planner_projects
        SET active_snapshot_id = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
    )
      .bind(replacement?.id ?? "", new Date().toISOString(), projectId, userId)
      .run();
  }

  return true;
}

async function syncPlannerProjects(
  env: CanvasAuthEnv,
  userId: string,
  input: SyncPlannerProjectsInput,
) {
  const existingProjects = await env.DB.prepare(
    `
      SELECT id
      FROM planner_projects
      WHERE user_id = ?
    `,
  )
    .bind(userId)
    .all<{ id: string }>();

  for (const project of existingProjects.results) {
    await env.DB.prepare(
      `
        DELETE FROM planner_snapshots
        WHERE project_id = ?
      `,
    )
      .bind(project.id)
      .run();
  }

  await env.DB.prepare(
    `
      DELETE FROM planner_projects
      WHERE user_id = ?
    `,
  )
    .bind(userId)
    .run();

  for (const project of input.projects) {
    await env.DB.prepare(
      `
        INSERT INTO planner_projects (id, user_id, name, active_snapshot_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        project.id,
        userId,
        project.name.trim(),
        project.activeSnapshotId,
        project.createdAt,
        project.updatedAt,
      )
      .run();

    for (const snapshot of project.snapshots) {
      await env.DB.prepare(
        `
          INSERT INTO planner_snapshots (id, project_id, name, state_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          snapshot.id,
          project.id,
          snapshot.name.trim(),
          JSON.stringify(snapshot.state),
          snapshot.createdAt,
          snapshot.updatedAt,
        )
        .run();
    }
  }

  return {
    activeProjectId: input.activeProjectId,
    projects: await getPlannerProjectsForUser(env, userId),
  };
}

async function importLocalLayouts(env: CanvasAuthEnv, userId: string, input: ImportLayoutsInput) {
  const importedLayouts: SavedLayoutRecord[] = [];

  for (const layout of input.layouts) {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `
        INSERT INTO layouts (id, user_id, title, url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(id, userId, layout.title.trim(), layout.url, layout.createdAt, layout.updatedAt)
      .run();

    importedLayouts.push({
      ...layout,
      id,
    });
  }

  return importedLayouts;
}

async function importLocalPlannerProjects(
  env: CanvasAuthEnv,
  userId: string,
  input: ImportPlannerProjectsInput,
) {
  const importedProjects: PlannerProjectRecord[] = [];

  for (const project of input.projects) {
    const projectId = crypto.randomUUID();
    const snapshotIdMap = new Map<string, string>();
    const importedSnapshots = project.snapshots.map((snapshot) => {
      const nextId = crypto.randomUUID();
      snapshotIdMap.set(snapshot.id, nextId);
      return {
        ...snapshot,
        id: nextId,
      };
    });
    const activeSnapshotId =
      snapshotIdMap.get(project.activeSnapshotId) ??
      importedSnapshots[0]?.id ??
      crypto.randomUUID();

    await env.DB.prepare(
      `
        INSERT INTO planner_projects (id, user_id, name, active_snapshot_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        projectId,
        userId,
        project.name.trim(),
        activeSnapshotId,
        project.createdAt,
        project.updatedAt,
      )
      .run();

    for (const snapshot of importedSnapshots) {
      await env.DB.prepare(
        `
          INSERT INTO planner_snapshots (id, project_id, name, state_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          snapshot.id,
          projectId,
          snapshot.name.trim(),
          JSON.stringify(snapshot.state),
          snapshot.createdAt,
          snapshot.updatedAt,
        )
        .run();
    }

    importedProjects.push({
      ...project,
      id: projectId,
      activeSnapshotId,
      snapshots: importedSnapshots,
    });
  }

  return importedProjects;
}

async function parseJsonBody<T>(
  request: Request,
  validate: (value: unknown) => asserts value is T,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RequestValidationError("Expected application/json request body", 415);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > MAX_JSON_BODY_BYTES) {
      throw new RequestValidationError("Request body is too large", 413);
    }
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new RequestValidationError("Invalid JSON request body");
  }

  validate(value);
  return value;
}

function handleRouteError(errorValue: unknown) {
  if (errorValue instanceof RequestValidationError) {
    return error(errorValue.message, errorValue.status);
  }

  console.error("Unhandled auth-db route error", errorValue);
  return error("Internal server error", 500);
}

export async function handleLayoutsRequest(request: Request, env: CanvasAuthEnv) {
  try {
    const session = await requireSession(request, env);
    if (!session) {
      return error("Unauthorized", 401);
    }

    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const layoutId = segments[2] ?? null;

    if (request.method === "GET" && !layoutId) {
      return json({ layouts: await getLayoutsForUser(env, session.user.id) });
    }

    if (request.method === "POST" && !layoutId) {
      if (url.pathname.endsWith("/import-local")) {
        const body = await parseJsonBody<ImportLayoutsInput>(request, validateImportLayoutsInput);
        return json(
          { layouts: await importLocalLayouts(env, session.user.id, body) },
          { status: 201 },
        );
      }

      const body = await parseJsonBody<CreateLayoutInput>(request, validateCreateLayoutInput);
      return json({ layout: await createLayout(env, session.user.id, body) }, { status: 201 });
    }

    if (request.method === "PATCH" && layoutId) {
      const body = await parseJsonBody<UpdateLayoutInput>(request, validateUpdateLayoutInput);
      const layout = await updateLayout(env, session.user.id, layoutId, body);
      return layout ? json({ layout }) : error("Layout not found", 404);
    }

    if (request.method === "DELETE" && layoutId) {
      await deleteLayout(env, session.user.id, layoutId);
      return new Response(null, { status: 204 });
    }

    return error("Not found", 404);
  } catch (errorValue) {
    return handleRouteError(errorValue);
  }
}

export async function handlePlannerProjectsRequest(request: Request, env: CanvasAuthEnv) {
  try {
    const session = await requireSession(request, env);
    if (!session) {
      return error("Unauthorized", 401);
    }

    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const collectionAction = segments[2] ?? null;
    const projectId =
      collectionAction === "sync" || collectionAction === "import-local" ? null : collectionAction;
    const snapshotsSegment = segments[3] ?? null;
    const snapshotId = segments[4] ?? null;

    if (request.method === "GET" && !collectionAction) {
      return json({ projects: await getPlannerProjectsForUser(env, session.user.id) });
    }

    if (request.method === "POST" && collectionAction === "import-local") {
      const body = await parseJsonBody<ImportPlannerProjectsInput>(
        request,
        validateImportPlannerProjectsInput,
      );
      return json(
        { projects: await importLocalPlannerProjects(env, session.user.id, body) },
        { status: 201 },
      );
    }

    if (request.method === "POST" && collectionAction === "sync") {
      const body = await parseJsonBody<SyncPlannerProjectsInput>(
        request,
        validateSyncPlannerProjectsInput,
      );
      return json({ store: await syncPlannerProjects(env, session.user.id, body) });
    }

    if (request.method === "POST" && !collectionAction) {
      const body = await parseJsonBody<CreatePlannerProjectInput>(
        request,
        validateCreatePlannerProjectInput,
      );
      return json(
        { project: await createPlannerProject(env, session.user.id, body) },
        { status: 201 },
      );
    }

    if (request.method === "PATCH" && projectId && !snapshotsSegment) {
      const body = await parseJsonBody<UpdatePlannerProjectInput>(
        request,
        validateUpdatePlannerProjectInput,
      );
      const project = await updatePlannerProject(env, session.user.id, projectId, body);
      return project ? json({ project }) : error("Project not found", 404);
    }

    if (request.method === "DELETE" && projectId && !snapshotsSegment) {
      await deletePlannerProject(env, session.user.id, projectId);
      return new Response(null, { status: 204 });
    }

    if (request.method === "POST" && projectId && snapshotsSegment === "snapshots" && !snapshotId) {
      const body = await parseJsonBody<CreatePlannerSnapshotInput>(
        request,
        validateCreatePlannerSnapshotInput,
      );
      const snapshot = await createPlannerSnapshot(env, session.user.id, projectId, body);
      return snapshot ? json({ snapshot }, { status: 201 }) : error("Project not found", 404);
    }

    if (request.method === "PATCH" && projectId && snapshotsSegment === "snapshots" && snapshotId) {
      const body = await parseJsonBody<UpdatePlannerSnapshotInput>(
        request,
        validateUpdatePlannerSnapshotInput,
      );
      const snapshot = await updatePlannerSnapshot(
        env,
        session.user.id,
        projectId,
        snapshotId,
        body,
      );
      return snapshot ? json({ snapshot }) : error("Snapshot not found", 404);
    }

    if (
      request.method === "DELETE" &&
      projectId &&
      snapshotsSegment === "snapshots" &&
      snapshotId
    ) {
      const deleted = await deletePlannerSnapshot(env, session.user.id, projectId, snapshotId);
      return deleted ? new Response(null, { status: 204 }) : error("Snapshot not found", 404);
    }

    return error("Not found", 404);
  } catch (errorValue) {
    return handleRouteError(errorValue);
  }
}
