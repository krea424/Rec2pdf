const path = require('path');
const supertest = require('supertest');

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

let createClient;

describe('GET /api/workspaces without Supabase', () => {
  let app;
  let request;

  beforeAll(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');
    jest.resetModules();
    ({ createClient } = require('@supabase/supabase-js'));
    createClient.mockReset();

    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterAll(() => {
    delete process.env.PORT;
    delete process.env.TEMPLATES_DIR;
  });

  it('returns 503 when Supabase is not configured', async () => {
    const res = await request.get('/api/workspaces');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });
});

describe('GET /api/workspaces with Supabase data', () => {
  let app;
  let request;
  let mockFrom;
  let mockAuth;
  let workspaceRow;
  let profileRow;
  let workspaceSelectBuilder;
  const ownerId = '123e4567-e89b-12d3-a456-426614174000';

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');

    workspaceRow = {
      id: '7e1c91f4-4328-4a71-8f90-8c4be0d07d31',
      owner_id: ownerId,
      slug: 'acme-consulting',
      name: 'Acme Consulting',
      description: 'Acme Consulting',
      logo_path: null,
      metadata: {
        client: 'Acme Consulting',
        color: '#4f46e5',
        versioningPolicy: {
          retentionLimit: 5,
          freezeOnPublish: false,
          namingConvention: 'timestamped',
        },
      },
      projects: [
        {
          id: 'proj-123',
          name: 'Discovery',
          color: '#4f46e5',
          statuses: ['In corso'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      default_statuses: ['Bozza', 'In lavorazione'],
      created_at: '2024-07-31T10:00:00.000Z',
      updated_at: '2024-07-31T10:00:00.000Z',
    };

    profileRow = {
      id: '0d6494d2-6d58-4f19-a43d-6157b4fdd991',
      workspace_id: workspaceRow.id,
      slug: 'default-profile',
      dest_dir: '/tmp/output',
      pdf_logo_url: 'https://cdn.example.com/logo.png',
      metadata: {
        label: 'Profilo default',
        promptId: 'prompt_custom',
        pdfTemplate: 'template.tex',
      },
      created_at: '2024-07-31T10:05:00.000Z',
      updated_at: '2024-07-31T10:05:00.000Z',
    };

    const mockWorkspaceOrder = jest.fn(() => Promise.resolve({ data: [workspaceRow], error: null }));
    workspaceSelectBuilder = {
      eq: jest.fn(() => workspaceSelectBuilder),
      order: mockWorkspaceOrder,
      maybeSingle: jest.fn(() => Promise.resolve({ data: workspaceRow, error: null })),
    };
    workspaceSelectBuilder.eq.mockImplementation(() => workspaceSelectBuilder);

    const mockProfilesIn = jest.fn(() => Promise.resolve({ data: [profileRow], error: null }));
    const mockProfilesSelect = jest.fn(() => ({ in: mockProfilesIn }));

    mockFrom = jest.fn((table) => {
      if (table === 'workspaces') {
        return {
          select: jest.fn(() => workspaceSelectBuilder),
        };
      }
      if (table === 'profiles') {
        return { select: mockProfilesSelect };
      }
      return { select: jest.fn(() => ({ order: jest.fn(() => Promise.resolve({ data: [], error: null })) })) };
    });

    mockAuth = {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: ownerId } }, error: null })),
    };

    jest.resetModules();
    ({ createClient } = require('@supabase/supabase-js'));
    createClient.mockReset();
    createClient.mockReturnValue({ from: mockFrom, auth: mockAuth });

    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterAll(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.PORT;
    delete process.env.TEMPLATES_DIR;
    createClient.mockReset();
  });

  it('maps Supabase workspaces and profiles to API response', async () => {
    const res = await request
      .get('/api/workspaces')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.workspaces)).toBe(true);
    const [workspace] = res.body.workspaces;
    expect(workspace).toMatchObject({
      id: workspaceRow.id,
      name: 'Acme Consulting',
      client: 'Acme Consulting',
      color: '#4f46e5',
      defaultStatuses: ['Bozza', 'In lavorazione'],
    });
    expect(workspace.profiles).toHaveLength(1);
    expect(workspace.profiles[0]).toMatchObject({
      id: profileRow.id,
      label: 'Profilo default',
      promptId: 'prompt_custom',
      pdfLogoUrl: 'https://cdn.example.com/logo.png',
    });
    expect(workspace.ownerId).toBe(ownerId);
    expect(createClient).toHaveBeenCalled();
    expect(mockAuth.getUser).toHaveBeenCalledWith('test-token');
    expect(mockFrom).toHaveBeenCalledWith('workspaces');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(workspaceSelectBuilder.eq).toHaveBeenCalledWith('owner_id', ownerId);
  });
});

describe('POST /api/workspaces', () => {
  let app;
  let request;
  let mockFrom;
  let mockAuth;
  let workspaceRow;
  let insertSpy;
  let profileUpsert;
  const ownerId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');

    workspaceRow = {
      id: '9f74a6aa-1c73-4d9b-8fc1-a2d6209ed995',
      owner_id: ownerId,
      slug: 'nuovo-workspace',
      name: 'Nuovo Workspace',
      description: 'Nuovo Workspace',
      logo_path: null,
      metadata: { client: 'Nuovo Workspace', color: '#4f46e5' },
      projects: [],
      default_statuses: ['Bozza', 'In lavorazione'],
      created_at: '2024-08-20T10:00:00.000Z',
      updated_at: '2024-08-20T10:00:00.000Z',
    };

    const mockWorkspaceOrder = jest.fn(() => Promise.resolve({ data: [workspaceRow], error: null }));
    const workspaceSelectBuilder = {
      eq: jest.fn(() => workspaceSelectBuilder),
      order: mockWorkspaceOrder,
      maybeSingle: jest.fn(() => Promise.resolve({ data: workspaceRow, error: null })),
    };
    workspaceSelectBuilder.eq.mockImplementation(() => workspaceSelectBuilder);

    insertSpy = jest.fn();
    insertSpy.mockImplementation((payload) => ({
      select: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve({
            data: { ...workspaceRow, ...payload, owner_id: ownerId },
            error: null,
          })
        ),
      })),
    }));

    profileUpsert = jest.fn(() => Promise.resolve({ data: [{ id: ownerId }], error: null }));
    const profileSelect = jest.fn(() => ({ in: jest.fn(() => Promise.resolve({ data: [], error: null })) }));

    mockAuth = {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: ownerId } }, error: null })),
    };

    mockFrom = jest.fn((table) => {
      if (table === 'workspaces') {
        return {
          select: jest.fn(() => workspaceSelectBuilder),
          insert: insertSpy,
        };
      }
      if (table === 'profiles') {
        return {
          select: profileSelect,
          upsert: profileUpsert,
        };
      }
      if (table === 'prompts') {
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        };
      }
      return { select: jest.fn(() => ({ order: jest.fn(() => Promise.resolve({ data: [], error: null })) })) };
    });

    jest.resetModules();
    ({ createClient } = require('@supabase/supabase-js'));
    createClient.mockReset();
    createClient.mockReturnValue({ from: mockFrom, auth: mockAuth });

    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.PORT;
    delete process.env.TEMPLATES_DIR;
    createClient.mockReset();
  });

  it('crea un workspace associando owner_id all’utente autenticato', async () => {
    const response = await request
      .post('/api/workspaces')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Nuovo Workspace', color: '#4f46e5' });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.workspace).toMatchObject({
      name: 'Nuovo Workspace',
      ownerId,
    });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const [payload] = insertSpy.mock.calls[0];
    expect(payload.owner_id).toBe(ownerId);
    expect(mockAuth.getUser).toHaveBeenCalledWith('test-token');
    expect(profileUpsert).toHaveBeenCalledTimes(1);
    expect(profileUpsert).toHaveBeenCalledWith(
      {
        id: ownerId,
        email: null,
        full_name: null,
      },
      { onConflict: 'id', ignoreDuplicates: false }
    );
  });

  it('ritenta la creazione quando la prima insert fallisce per politiche RLS', async () => {
    let attempts = 0;
    insertSpy.mockImplementation((payload) => ({
      select: jest.fn(() => ({
        single: jest.fn(() => {
          attempts += 1;
          if (attempts === 1) {
            return Promise.resolve({
              data: null,
              error: {
                message: 'new row violates row-level security policy for table "workspaces"',
              },
            });
          }
          return Promise.resolve({
            data: { ...workspaceRow, ...payload, owner_id: ownerId },
            error: null,
          });
        }),
      })),
    }));

    const response = await request
      .post('/api/workspaces')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Workspace con retry' });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.workspace.ownerId).toBe(ownerId);
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(profileUpsert).toHaveBeenCalledTimes(2);
  });
});
