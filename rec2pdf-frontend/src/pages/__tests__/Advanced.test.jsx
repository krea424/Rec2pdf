import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdvancedPage from '../Advanced.jsx'

vi.mock('../../features/advanced/InputManager', () => ({
  default: ({ context }) => (
    <div data-testid="input-manager">Input manager mock – mode {context?.mode}</div>
  ),
}))

const mockUseAppContext = vi.fn()

vi.mock('../../hooks/useAppContext', () => ({
  useAppContext: () => mockUseAppContext(),
}))

const buildContext = (overrides = {}) => {
  const flags = overrides.flags ?? ['MODE_BASE', 'MODE_ADVANCED', 'MODE_ADVANCED_V2']
  const hasModeFlag = vi.fn((flag) => flags.includes(flag))

  return {
    mode: 'advanced',
    flags,
    theme: 'boardroom',
    themes: {
      boardroom: {},
    },
    secureOK: true,
    errorBanner: null,
    setErrorBanner: vi.fn(),
    hasModeFlag: overrides.hasModeFlag ?? hasModeFlag,
    ...overrides,
  }
}

const renderWithRouter = (ui) =>
  render(<MemoryRouter initialEntries={[{ pathname: '/advanced' }]}>{ui}</MemoryRouter>)

describe('AdvancedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks access when MODE_ADVANCED flag is missing', () => {
    const context = buildContext({ flags: ['MODE_BASE'] })
    mockUseAppContext.mockReturnValue(context)

    renderWithRouter(<AdvancedPage />)

    expect(screen.getByText(/Modalità avanzata non disponibile/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create' })).toHaveAttribute('href', '/create')
  })

  it('shows rollout notice when MODE_ADVANCED_V2 is missing', () => {
    const context = buildContext({ flags: ['MODE_BASE', 'MODE_ADVANCED'] })
    mockUseAppContext.mockReturnValue(context)

    renderWithRouter(<AdvancedPage />)

    expect(screen.getByText(/Nuova control room in rollout/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create' })).toHaveAttribute('href', '/create')
  })

  it('renders the advanced control room when all flags are present', () => {
    const context = buildContext()
    mockUseAppContext.mockReturnValue(context)

    renderWithRouter(<AdvancedPage />)

    expect(screen.getByTestId('input-manager')).toHaveTextContent('mode advanced')
  })
})
