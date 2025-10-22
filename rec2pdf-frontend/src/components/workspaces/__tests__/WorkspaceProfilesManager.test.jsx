import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    profiles: [],
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
    pdfTemplates: templatesFixture,
    pdfTemplatesLoading: false,
    pdfTemplatesError: null,
    DEFAULT_DEST_DIR: '',
    DEFAULT_WORKSPACE_STATUSES: ['Bozza', 'In lavorazione'],
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
});
