import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CommandPalette from '../CommandPalette'
import { AppContext } from '../../hooks/useAppContext.jsx'

describe('CommandPalette', () => {
  const baseContextValue = {
    recording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    fileInputRef: { current: { click: vi.fn() } },
    mode: 'advanced',
    setMode: vi.fn(),
    availableModes: ['base', 'advanced'],
    mediaSupported: true,
    recorderSupported: true,
    busy: false,
  }

  const renderPalette = (contextOverrides = {}) =>
    render(
      <MemoryRouter initialEntries={['/create']}>
        <AppContext.Provider value={{ ...baseContextValue, ...contextOverrides }}>
          <CommandPalette />
        </AppContext.Provider>
      </MemoryRouter>,
    )

  afterEach(() => {
    baseContextValue.startRecording.mockClear()
    baseContextValue.stopRecording.mockClear()
    baseContextValue.fileInputRef.current.click.mockClear()
    baseContextValue.setMode.mockClear()
  })

  it('opens with keyboard shortcut and toggles mode', async () => {
    renderPalette()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(await screen.findByText(/Command palette/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'b' })

    await waitFor(() => {
      expect(baseContextValue.setMode).toHaveBeenCalledWith('base')
    })

    await waitFor(() => {
      expect(screen.queryByText(/Command palette/i)).not.toBeInTheDocument()
    })
  })

  it('triggers audio upload command via shortcut', async () => {
    renderPalette()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(await screen.findByText(/Command palette/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'u' })

    await waitFor(() => {
      expect(baseContextValue.fileInputRef.current.click).toHaveBeenCalled()
    })
  })
})
