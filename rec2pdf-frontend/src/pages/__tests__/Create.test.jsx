import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import CreatePage from '../Create.jsx'

vi.mock('../../features/base/BaseHome', () => ({
  default: () => <div data-testid="base-home">Base home mock</div>,
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
  const hasFeatureFlag = overrides.hasFeatureFlag ?? vi.fn((flag) => flags.includes(flag))

  const context = {
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

  context.hasFeatureFlag = hasFeatureFlag
  context.hasModeFlag = overrides.hasModeFlag ?? hasFeatureFlag

  return context
}

describe('CreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the base journey by default', () => {
    mockUseAppContext.mockReturnValue(buildContext())
    render(<CreatePage />)

    expect(screen.getByTestId('base-home')).toBeInTheDocument()
  })

  it('shows an access banner when MODE_ADVANCED flag is missing', () => {
    const context = buildContext({
      flags: ['MODE_BASE'],
    })
    mockUseAppContext.mockReturnValue(context)
    render(<CreatePage />)

    expect(screen.getByText(/Modalità avanzata non disponibile/i)).toBeInTheDocument()
    expect(screen.getByTestId('base-home')).toBeInTheDocument()
  })

  it('shows the rollout banner when MODE_ADVANCED_V2 is missing', () => {
    const context = buildContext({
      flags: ['MODE_BASE', 'MODE_ADVANCED'],
    })
    mockUseAppContext.mockReturnValue(context)
    render(<CreatePage />)

    expect(screen.getByText(/Nuova control room in rollout/i)).toBeInTheDocument()
    expect(screen.getByTestId('base-home')).toBeInTheDocument()
  })

  it('hides advanced banners when both MODE_ADVANCED and MODE_ADVANCED_V2 are enabled', () => {
    const context = buildContext({
      flags: ['MODE_BASE', 'MODE_ADVANCED', 'MODE_ADVANCED_V2'],
    })
    mockUseAppContext.mockReturnValue(context)
    render(<CreatePage />)

    expect(screen.getByTestId('base-home')).toBeInTheDocument()
    expect(screen.queryByText(/Modalità avanzata non disponibile/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Nuova control room in rollout/i)).not.toBeInTheDocument()
  })
})
