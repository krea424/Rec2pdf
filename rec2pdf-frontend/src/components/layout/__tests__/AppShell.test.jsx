import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from '../AppShell'
import { AppProvider } from '../../../hooks/useAppContext'
import { ModeProvider } from '../../../context/ModeContext'

const baseThemes = {
  boardroom: {
    bg: '',
    card: '',
    input: '',
    input_hover: '',
    button: '',
    log: '',
  },
}

const renderWithContext = (contextOverrides = {}, initialEntries = ['/create']) => {
  const defaultContext = {
    customLogo: null,
    settingsOpen: false,
    setSettingsOpen: () => {},
    openSettingsDrawer: vi.fn(),
    toggleFullScreen: vi.fn(),
    handleLogout: vi.fn(),
    theme: 'boardroom',
    themes: baseThemes,
    shouldShowOnboardingBanner: false,
    diagnostics: { status: 'idle', message: '' },
    openSetupAssistant: vi.fn(),
  }

  const value = { ...defaultContext, ...contextOverrides }

  const view = render(
    <ModeProvider session={null}>
      <AppProvider value={value}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/create" element={<div>Create view</div>} />
              <Route path="/library" element={<div>Library view</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProvider>
    </ModeProvider>
  )

  return { ...view, context: value }
}

describe('AppShell', () => {
  it('renders navigation and fires logout handler', async () => {
    const handleLogout = vi.fn()
    renderWithContext({ handleLogout })

    const createLink = screen.getByRole('link', { name: 'Create' })
    expect(createLink).toHaveAttribute('href', '/create')

    const logoutButton = screen.getByRole('button', { name: 'Logout' })
    await userEvent.click(logoutButton)
    expect(handleLogout).toHaveBeenCalledTimes(1)
  })

  it('shows onboarding banner when diagnostics require attention', async () => {
    const openSetupAssistant = vi.fn()
    renderWithContext({
      shouldShowOnboardingBanner: true,
      diagnostics: { status: 'error', message: 'Backend offline' },
      openSetupAssistant,
    })

    expect(screen.getByText("La diagnostica richiede attenzione")).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Apri assistente' })
    await userEvent.click(button)
    expect(openSetupAssistant).toHaveBeenCalledTimes(1)
  })
})
