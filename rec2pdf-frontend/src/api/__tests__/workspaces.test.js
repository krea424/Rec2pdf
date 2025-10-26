import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_STATUSES,
  parseWorkspaceResponse,
  parseWorkspacesResponse,
} from '../workspaces.js';

describe('workspaces API helpers', () => {
  it('maps snake_case payloads and JSONB projects to normalized records', () => {
    const payload = {
      workspaces: [
        {
          id: 'ws-1',
          slug: 'acme-workspace',
          name: 'ACME Workspace',
          metadata: {
            client: 'ACME Corp',
            color: '#4f46e5',
            versioningPolicy: {
              retention_limit: 5,
              freeze_on_publish: false,
              naming_convention: 'timestamped',
            },
          },
          default_statuses: ['Bozza', 'In lavorazione', 'Completato'],
          projects: JSON.stringify([
            {
              id: 'proj-1',
              name: 'Kickoff',
              color: '#4f46e5',
              statuses: ['Bozza', 'Completato'],
              createdAt: '2024-07-01T09:00:00.000Z',
              updatedAt: '2024-07-05T10:00:00.000Z',
            },
          ]),
          profiles: [
            {
              id: 'prof-1',
              label: 'Profilo standard',
              promptId: 'prompt-1',
              pdfLogoPath: '',
            },
          ],
          created_at: '2024-07-01T09:00:00.000Z',
          updated_at: '2024-07-10T10:00:00.000Z',
        },
      ],
    };

    const { workspaces } = parseWorkspacesResponse(payload);
    expect(workspaces).toHaveLength(1);
    const workspace = workspaces[0];
    expect(workspace).toMatchObject({
      id: 'ws-1',
      name: 'ACME Workspace',
      client: 'ACME Corp',
      color: '#4f46e5',
    });
    expect(workspace.defaultStatuses).toEqual(['Bozza', 'In lavorazione', 'Completato']);
    expect(Array.isArray(workspace.projects)).toBe(true);
    expect(workspace.projects).toHaveLength(1);
    const [project] = workspace.projects;
    expect(project).toMatchObject({
      id: 'proj-1',
      name: 'Kickoff',
      color: '#4f46e5',
      statuses: ['Bozza', 'Completato'],
    });
    expect(typeof project.createdAt).toBe('number');
    expect(workspace.versioningPolicy).toMatchObject({
      retentionLimit: 5,
      freezeOnPublish: false,
      namingConvention: 'timestamped',
    });
  });

  it('falls back to default statuses when response omits them', () => {
    const payload = {
      workspace: {
        id: 'ws-2',
        name: 'Workspace senza stati',
        metadata: { client: 'Client', color: '#ff5722' },
        projects: [],
      },
    };

    const { workspace } = parseWorkspaceResponse(payload);
    expect(workspace?.defaultStatuses).toEqual(DEFAULT_WORKSPACE_STATUSES);
  });
});
