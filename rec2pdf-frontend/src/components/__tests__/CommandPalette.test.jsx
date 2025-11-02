import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import CommandPalette from '../CommandPalette'
import { AppContext } from '../../hooks/useAppContext.jsx'

describe('CommandPalette', () => {
  const baseContextValue = {
    recording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    fileInputRef: { current: { click: vi.fn() } },
    mediaSupported: true,
    recorderSupported: true,
    busy: false,
  }

  const Wrapper = () => {
    const location = useLocation()

    return (
      <>
        <span data-testid="location">{location.pathname}</span>
        <CommandPalette />
      </>
    )
  }

  const renderPalette = (contextOverrides = {}) =>
    render(
      <MemoryRouter initialEntries={['/create']}>
        <AppContext.Provider value={{ ...baseContextValue, ...contextOverrides }}>
          <Routes>
            <Route path="*" element={<Wrapper />} />
          </Routes>
        </AppContext.Provider>
      </MemoryRouter>,
    )

  afterEach(() => {
    baseContextValue.startRecording.mockClear()
    baseContextValue.stopRecording.mockClear()
    baseContextValue.fileInputRef.current.click.mockClear()
  })

  it('opens with keyboard shortcut and navigates to Advanced A', async () => {
    renderPalette()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(await screen.findByText(/Command palette/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'a' })

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/advanced')
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
