import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import CreatePage from '../Create.jsx'

vi.mock('../../features/base/BaseHome', () => ({
  default: () => <div data-testid="base-home">Base home mock</div>,
}))

vi.mock('../../features/advanced/SetupPanel', () => ({
  default: () => <div data-testid="setup-panel">Setup panel mock</div>,
}))

vi.mock('../../features/advanced/InputManager', () => ({
  default: ({ context }) => (
    <div data-testid="input-manager">Input manager mock – mode {context?.mode}</div>
  ),
}))

vi.mock('../../context/AnalyticsContext', () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}))

const mockUseAppContext = vi.fn()

vi.mock('../../hooks/useAppContext', () => ({
  useAppContext: () => mockUseAppContext(),
}))

const baseThemes = {
  boardroom: {
    card: 'card',
    input: 'input',
    input_hover: 'input-hover',
    button: 'button',
  },
  zinc: {
    card: 'card',
    input: 'input',
    input_hover: 'input-hover',
    button: 'button',
  },
}

const basePipelineStages = [
  { key: 'upload', label: 'Upload', description: 'Upload file' },
  { key: 'transcribe', label: 'Trascrizione', description: 'Trascrizione' },
  { key: 'complete', label: 'Completata', description: 'Completata' },
]

const baseStatusStyles = {
  idle: 'idle',
  pending: 'pending',
  running: 'running',
  done: 'done',
  failed: 'failed',
  info: 'info',
}

const buildContext = (overrides = {}) => {
  const flags = overrides.flags ?? ['MODE_BASE']
  const hasModeFlag = vi.fn((flag) => flags.includes(flag))

  const context = {
    mode: 'base',
    flags,
    theme: 'boardroom',
    themes: baseThemes,
    headerStatus: null,
    pipelineComplete: false,
    pipelineStatus: {},
    PIPELINE_STAGES: basePipelineStages,
    stageMessages: {},
    STAGE_STATUS_STYLES: baseStatusStyles,
    STAGE_STATUS_LABELS: {
      idle: 'In attesa',
      pending: 'In coda',
      running: 'In corso',
      done: 'Completata',
      failed: 'Errore',
      info: 'Info',
    },
    failedStage: null,
    activeStageKey: null,
    progressPercent: 0,
    completedStagesCount: 0,
    totalStages: basePipelineStages.length,
    workspaceProjects: [],
    workspaceSelection: { projectId: '', projectName: '', status: '' },
    activeWorkspace: null,
    promptState: { focus: '', cueCards: [] },
    activePrompt: null,
    audioBlob: null,
    fmtBytes: vi.fn((value) => `${value ?? 0} bytes`),
    fmtTime: vi.fn(() => '00:00:00'),
    elapsed: 0,
    processViaBackend: vi.fn(),
    openSettingsDrawer: vi.fn(),
    showRawLogs: false,
    setShowRawLogs: vi.fn(),
    customPdfLogo: null,
    setCustomPdfLogo: vi.fn(),
    setErrorBanner: vi.fn(),
    errorBanner: null,
    setMode: vi.fn(),
    toggleMode: vi.fn(),
    fileInputRef: { current: null },
    onPickFile: vi.fn(),
    markdownInputRef: { current: null },
    handleMarkdownFilePicked: vi.fn(),
    lastMarkdownUpload: null,
    textInputRef: { current: null },
    handleTextFilePicked: vi.fn(),
    lastTextUpload: null,
    workspaceProfileSelection: {},
    workspaceProfileLocked: false,
    applyWorkspaceProfile: vi.fn(() => ({ ok: true })),
    clearWorkspaceProfile: vi.fn(),
    workspaceProjectsLoading: false,
    workspaceProfileOptions: [],
    pipelineLogs: [],
    secureOK: true,
    history: [],
    baseJourneyVisibility: {},
    busy: false,
    recording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    level: 0,
    permission: 'prompt',
    permissionMessage: '',
    mediaSupported: true,
    recorderSupported: true,
    mime: '',
    ...overrides,
  }

  context.hasModeFlag = overrides.hasModeFlag ?? hasModeFlag

  return context
}

describe('CreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the base journey when mode is base', () => {
    mockUseAppContext.mockReturnValue(buildContext())
    render(<CreatePage />)

    expect(screen.getByTestId('base-home')).toBeInTheDocument()
  })

  it('blocks advanced mode when MODE_ADVANCED flag is missing', () => {
    const context = buildContext({
      mode: 'advanced',
      flags: ['MODE_BASE'],
    })
    mockUseAppContext.mockReturnValue(context)
    render(<CreatePage />)

    expect(screen.getByText(/Modalità avanzata non disponibile/i)).toBeInTheDocument()
    expect(screen.getByTestId('base-home')).toBeInTheDocument()
  })

  it('falls back to the legacy advanced view when MODE_ADVANCED_V2 is missing', () => {
    const context = buildContext({
      mode: 'advanced',
      flags: ['MODE_BASE', 'MODE_ADVANCED'],
    })
    mockUseAppContext.mockReturnValue(context)
    render(<CreatePage />)

    expect(screen.getByText(/Nuova control room in rollout/i)).toBeInTheDocument()
    expect(screen.getByText(/Supabase → Authentication → Users/i)).toBeInTheDocument()
    expect(screen.getByText(/VITE_DEFAULT_MODE_FLAGS=MODE_BASE,MODE_ADVANCED,MODE_ADVANCED_V2/i)).toBeInTheDocument()
    expect(screen.getByTestId('base-home')).toBeInTheDocument()
  })

  it('renders the advanced control room when MODE_ADVANCED_V2 is enabled', () => {
    const context = buildContext({
      mode: 'advanced',
      flags: ['MODE_BASE', 'MODE_ADVANCED', 'MODE_ADVANCED_V2'],
    })
    mockUseAppContext.mockReturnValue(context)
    render(<CreatePage />)

    expect(screen.queryByTestId('base-home')).not.toBeInTheDocument()
    expect(screen.getByTestId('setup-panel')).toBeInTheDocument()
    expect(screen.getByTestId('input-manager')).toHaveTextContent('mode advanced')
  })
})
