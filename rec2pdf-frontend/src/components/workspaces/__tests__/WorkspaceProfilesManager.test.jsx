import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceProfilesManager from '../WorkspaceProfilesManager.jsx';
import { AppContext } from '../../../hooks/useAppContext.jsx';

const templatesFixture = [
  {
    name: 'Report HTML',
    fileName: 'report.html',
    type: 'html',
    cssFileName: 'report.css',
    description: 'Template standard per report HTML',
  },
  {
    name: 'Verbale DOCX',
    fileName: 'verbale.docx',
    type: 'docx',
    cssFileName: '',
    description: '',
  },
];

const workspacesFixture = [
  {
    id: 'ws-1',
    name: 'Workspace Demo',
    client: 'ACME',
    color: '#6366f1',
    destDir: '',
    defaultStatuses: ['Bozza', 'In lavorazione'],
    profiles: [],
    projects: [],
  },
];

const renderComponent = (overrides = {}) => {
  const contextValue = {
    workspaces: workspacesFixture,
    workspaceSelection: { workspaceId: 'ws-1', projectId: '', projectName: '', status: '' },
    prompts: [],
    handleRefreshWorkspaces: vi.fn(),
    handleCreateWorkspace: vi.fn().mockResolvedValue({ ok: true, workspace: { id: 'ws-2', name: 'New workspace' } }),
    handleUpdateWorkspace: vi.fn().mockResolvedValue({ ok: true }),
    handleDeleteWorkspace: vi.fn().mockResolvedValue({ ok: true }),
    refreshPdfTemplates: vi.fn(),
    createWorkspaceProfile: vi.fn(),
    updateWorkspaceProfile: vi.fn(),
    deleteWorkspaceProfile: vi.fn(),
    createWorkspaceProject: vi.fn().mockResolvedValue({ ok: true, project: null, projects: [] }),
    updateWorkspaceProject: vi.fn().mockResolvedValue({ ok: true, project: null, projects: [] }),
    deleteWorkspaceProject: vi.fn().mockResolvedValue({ ok: true, projects: [] }),
    pdfTemplates: templatesFixture,
    pdfTemplatesLoading: false,
    pdfTemplatesError: null,
    DEFAULT_DEST_DIR: '',
    DEFAULT_WORKSPACE_STATUSES: ['Bozza', 'In lavorazione'],
    openSetupAssistant: vi.fn(),
    handleSelectWorkspaceForPipeline: vi.fn(),
    ...overrides,
  };

  return render(
    <AppContext.Provider value={contextValue}>
      <WorkspaceProfilesManager />
    </AppContext.Provider>
  );
};

describe('WorkspaceProfilesManager', () => {
  it('renders template options from context', () => {
    renderComponent();

    const templateSelect = screen.getByLabelText(/Template PDF/i);
    expect(templateSelect).toBeInTheDocument();

    expect(screen.getByRole('option', { name: /Report HTML/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Verbale DOCX/ })).toBeInTheDocument();
  });

  it('updates form state when selecting a template', async () => {
    renderComponent();
    const user = userEvent.setup();

    const templateSelect = screen.getByLabelText(/Template PDF/i);
    await user.selectOptions(templateSelect, 'report.html');

    expect(templateSelect).toHaveValue('report.html');
  });

  it('creates a workspace project from the settings drawer', async () => {
    const createWorkspaceProject = vi.fn().mockResolvedValue({
      ok: true,
      project: { id: 'proj-1', name: 'Discovery', statuses: ['Bozza', 'Review'] },
      projects: [
        { id: 'proj-1', name: 'Discovery', statuses: ['Bozza', 'Review'] },
      ],
    });
    renderComponent({ createWorkspaceProject });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Progetti/i }));
    await user.click(screen.getByRole('button', { name: /Nuovo progetto/i }));

    const nameInput = screen.getByLabelText(/Nome progetto/i);
    await user.type(nameInput, 'Discovery');
    const statusesInput = screen.getByLabelText(/Stati/i);
    await user.clear(statusesInput);
    await user.type(statusesInput, 'Bozza, Review');

    await user.click(screen.getByRole('button', { name: /Crea progetto/i }));

    await waitFor(() => {
      expect(createWorkspaceProject).toHaveBeenCalledWith('ws-1', {
        name: 'Discovery',
        color: '#6366f1',
        destDir: '',
        statuses: ['Bozza', 'Review'],
      });
    });

    expect(await screen.findByText(/Progetto creato/i)).toBeInTheDocument();
  });

  it('accumula messaggi di errore consecutivi per i progetti', async () => {
    const createWorkspaceProject = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: 'Errore A' })
      .mockResolvedValueOnce({ ok: false, message: 'Errore B', details: ['Dettaglio'] });
    renderComponent({ createWorkspaceProject });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Progetti/i }));
    await user.click(screen.getByRole('button', { name: /Nuovo progetto/i }));

    const nameInput = screen.getByLabelText(/Nome progetto/i);
    await user.type(nameInput, 'Alpha');
    await user.click(screen.getByRole('button', { name: /Crea progetto/i }));

    expect(await screen.findByText('Errore A')).toBeInTheDocument();

    await user.clear(nameInput);
    await user.type(nameInput, 'Beta');
    await user.click(screen.getByRole('button', { name: /Crea progetto/i }));

    await waitFor(() => expect(createWorkspaceProject).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Errore B')).toBeInTheDocument();
    expect(screen.getByText('Errore A')).toBeInTheDocument();
    expect(screen.getByText('Dettaglio')).toBeInTheDocument();
  });
});
