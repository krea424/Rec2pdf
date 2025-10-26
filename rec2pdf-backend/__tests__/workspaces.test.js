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

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');

    workspaceRow = {
      id: '7e1c91f4-4328-4a71-8f90-8c4be0d07d31',
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
    const mockWorkspaceSelect = jest.fn(() => ({ order: mockWorkspaceOrder }));

    const mockProfilesIn = jest.fn(() => Promise.resolve({ data: [profileRow], error: null }));
    const mockProfilesSelect = jest.fn(() => ({ in: mockProfilesIn }));

    mockFrom = jest.fn((table) => {
      if (table === 'workspaces') {
        return { select: mockWorkspaceSelect };
      }
      if (table === 'profiles') {
        return { select: mockProfilesSelect };
      }
      return { select: jest.fn(() => ({ order: jest.fn(() => Promise.resolve({ data: [], error: null })) })) };
    });

    mockAuth = {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-123' } }, error: null })),
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
    expect(createClient).toHaveBeenCalled();
    expect(mockAuth.getUser).toHaveBeenCalledWith('test-token');
    expect(mockFrom).toHaveBeenCalledWith('workspaces');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });
});
