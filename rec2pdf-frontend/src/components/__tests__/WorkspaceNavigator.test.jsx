import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkspaceNavigator from '../WorkspaceNavigator'
import { AppContext } from '../../hooks/useAppContext.jsx'

const themeStyles = {
  button: 'btn',
  input: 'input',
  input_hover: 'input-hover',
}

const sampleEntries = [
  {
    id: 'entry-1',
    title: 'Sintesi kickoff',
    timestamp: '2024-10-10T10:00:00.000Z',
    completenessScore: 82,
    workspace: {
      id: 'ws-1',
      name: 'ACME Workspace',
      client: 'ACME Corp',
      status: 'Bozza',
      projectId: 'proj-1',
      projectName: 'Kickoff',
      color: '#6366f1',
    },
    prompt: {
      title: 'Meeting recap',
      tags: ['meeting'],
      completedCues: ['agenda'],
    },
    structure: {
      missingSections: ['Next steps'],
      promptChecklist: {
        missing: ['Owner'],
      },
    },
  },
]

const sampleWorkspaces = [
  {
    id: 'ws-1',
    name: 'ACME Workspace',
    client: 'ACME Corp',
    color: '#6366f1',
    defaultStatuses: ['Bozza', 'In lavorazione', 'Completato'],
    projects: [
      {
        id: 'proj-1',
        key: 'proj-1',
        name: 'Kickoff',
        color: '#6366f1',
        statuses: ['Bozza', 'Completato'],
      },
    ],
  },
]

describe('WorkspaceNavigator', () => {
  it('renders entries and triggers refresh and search callbacks', async () => {
    const onRefresh = vi.fn()
    const onSearchChange = vi.fn()

    const hasModeFlag = vi.fn((flag) => flag === 'MODE_ADVANCED')

    render(
      <AppContext.Provider value={{ hasModeFlag }}>
        <WorkspaceNavigator
          entries={sampleEntries}
          workspaces={sampleWorkspaces}
          selection={{ workspaceId: 'ws-1', projectId: '', projectName: '', status: '' }}
          onSelectionChange={vi.fn()}
          savedFilters={[{ id: 'filter-1', name: 'Recenti' }]}

          onSaveFilter={vi.fn()}
          onDeleteFilter={vi.fn()}
          onApplyFilter={vi.fn()}
          searchTerm=""
          onSearchChange={onSearchChange}
          fetchPreview={vi.fn()}
          onOpenPdf={vi.fn()}
          onOpenMd={vi.fn()}
          onRepublish={vi.fn()}
          onShowLogs={vi.fn()}
          onAssignWorkspace={vi.fn()}
          themeStyles={themeStyles}
          loading={false}
          onRefresh={onRefresh}
          pipelineSelection={null}
        />
      </AppContext.Provider>
    )

    const entryButton = screen.getByRole('button', { name: /Sintesi kickoff/i })
    expect(entryButton).toBeInTheDocument()

    const refreshButton = screen.getByRole('button', { name: /Aggiorna/i })
    await userEvent.click(refreshButton)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    const searchField = screen.getByPlaceholderText(/Filtra per titolo/i)
    await userEvent.type(searchField, 'brief')
    expect(onSearchChange).toHaveBeenCalled()
  })

  it('falls back to the base navigator when advanced access flags are missing', () => {
    const hasModeFlag = vi.fn(() => false)

    render(
      <AppContext.Provider value={{ hasModeFlag }}>
        <WorkspaceNavigator
          entries={sampleEntries}
          workspaces={sampleWorkspaces}
          selection={{ workspaceId: 'ws-1', projectId: '', projectName: '', status: '' }}
          onSelectionChange={vi.fn()}
          savedFilters={[]}
          onSaveFilter={vi.fn()}
          onDeleteFilter={vi.fn()}
          onApplyFilter={vi.fn()}
          searchTerm=""
          onSearchChange={vi.fn()}
          fetchPreview={vi.fn()}
          onOpenPdf={vi.fn()}
          onOpenMd={vi.fn()}
          onRepublish={vi.fn()}
          onShowLogs={vi.fn()}
          onAssignWorkspace={vi.fn()}
          themeStyles={themeStyles}
          loading={false}
          onRefresh={vi.fn()}
          pipelineSelection={null}
        />
      </AppContext.Provider>
    )

    expect(screen.queryByText(/Rigenera PDF/i)).not.toBeInTheDocument()
  })
})
