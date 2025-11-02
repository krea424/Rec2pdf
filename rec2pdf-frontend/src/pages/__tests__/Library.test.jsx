import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LibraryPage from '../Library'
import { AppContext } from '../../hooks/useAppContext.jsx'

vi.mock('../../components/WorkspaceNavigator', () => ({
  default: () => <div data-testid="workspace-navigator" />,
}))

vi.mock('../../components/CloudLibraryPanel', () => ({
  default: () => <div data-testid="cloud-library" />,
}))

const HISTORY_TABS = [
  { key: 'history', label: 'Cronologia' },
  { key: 'cloud', label: 'Cloud library' },
]

const baseContextValue = {
  theme: 'dark',
  themes: { dark: {} },
  HISTORY_TABS,
  historyTab: 'history',
  setHistoryTab: vi.fn(),
  history: [],
  workspaces: [],
  navigatorSelection: null,
  setNavigatorSelection: vi.fn(),
  savedWorkspaceFilters: [],
  handleSaveWorkspaceFilter: vi.fn(),
  handleDeleteWorkspaceFilter: vi.fn(),
  handleApplyWorkspaceFilter: vi.fn(),
  historyFilter: '',
  setHistoryFilter: vi.fn(),
  fetchEntryPreview: vi.fn(),
  handleOpenHistoryPdf: vi.fn(),
  handleOpenHistoryMd: vi.fn(),
  handleRepublishFromMd: vi.fn(),
  handleShowHistoryLogs: vi.fn(),
  handleAssignEntryWorkspace: vi.fn(),
  handleAdoptNavigatorSelection: vi.fn(),
  normalizedBackendUrl: '',
  fetchBody: vi.fn(),
  handleLibraryWorkspaceSelection: vi.fn(),
  handleOpenLibraryFile: vi.fn(),
  workspaceLoading: false,
  workspaceSelection: null,
}

const renderLibrary = (overrides = {}) => {
  const contextValue = { ...baseContextValue, ...overrides }
  render(
    <AppContext.Provider value={contextValue}>
      <LibraryPage />
    </AppContext.Provider>
  )
  return contextValue
}

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('respects the stored tab selection and allows switching tabs', async () => {
    const user = userEvent.setup()
    const setHistoryTab = vi.fn()
    renderLibrary({ historyTab: 'cloud', setHistoryTab })

    const cloudTab = screen.getByRole('button', { name: /cloud library/i })
    expect(cloudTab).toHaveClass('bg-brand-500')
    expect(setHistoryTab).not.toHaveBeenCalled()

    const historyTab = screen.getByRole('button', { name: /cronologia/i })
    await user.click(historyTab)
    expect(setHistoryTab).toHaveBeenCalledWith('history')
  })

  it('normalizes an unknown stored tab to the first available option', () => {
    const setHistoryTab = vi.fn()
    renderLibrary({ historyTab: 'unknown', setHistoryTab })

    const historyTab = screen.getByRole('button', { name: /cronologia/i })
    expect(historyTab).toHaveClass('bg-brand-500')
    expect(setHistoryTab).toHaveBeenCalledWith('history')
  })
})
