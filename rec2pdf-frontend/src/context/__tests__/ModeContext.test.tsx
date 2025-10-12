import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeProvider, useMode } from '../ModeContext'
import { AnalyticsProvider } from '../AnalyticsContext'

describe('ModeContext', () => {
  const trackEvent = vi.fn()
  const trackToggleEvent = vi.fn()

  const session = {
    user: {
      id: 'user-1',
      app_metadata: {
        feature_flags: ['MODE_BASE', 'MODE_ADVANCED'],
      },
    },
  } as any

  const Consumer = () => {
    const { mode, setMode, toggleMode } = useMode()
    return (
      <div>
        <span data-testid="mode-value">{mode}</span>
        <button type="button" onClick={() => setMode('advanced')}>
          advanced
        </button>
        <button type="button" onClick={() => toggleMode()}>
          toggle
        </button>
      </div>
    )
  }

  beforeEach(() => {
    trackEvent.mockClear()
    trackToggleEvent.mockClear()
    window.localStorage.clear()
  })

  it('switches mode explicitly and cycles back while emitting analytics', async () => {
    const user = userEvent.setup()

    render(
      <AnalyticsProvider value={{ trackEvent, trackToggleEvent }}>
        <ModeProvider session={session} syncWithSupabase={false}>
          <Consumer />
        </ModeProvider>
      </AnalyticsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('mode-value')).toHaveTextContent('base')
    })

    await user.click(screen.getByRole('button', { name: /advanced/i }))

    await waitFor(() => {
      expect(screen.getByTestId('mode-value')).toHaveTextContent('advanced')
    })

    expect(trackToggleEvent).toHaveBeenCalledWith(
      'mode.toggle',
      true,
      expect.objectContaining({ previousMode: 'base', nextMode: 'advanced', trigger: 'explicit' }),
    )
    expect(trackEvent).toHaveBeenCalledWith(
      'mode.changed',
      expect.objectContaining({ previousMode: 'base', nextMode: 'advanced', trigger: 'explicit' }),
    )

    await user.click(screen.getByRole('button', { name: /toggle/i }))

    await waitFor(() => {
      expect(screen.getByTestId('mode-value')).toHaveTextContent('base')
    })

    expect(trackToggleEvent).toHaveBeenLastCalledWith(
      'mode.toggle',
      false,
      expect.objectContaining({ previousMode: 'advanced', nextMode: 'base', trigger: 'cycle' }),
    )
    expect(trackEvent).toHaveBeenLastCalledWith(
      'mode.changed',
      expect.objectContaining({ previousMode: 'advanced', nextMode: 'base', trigger: 'cycle' }),
    )
  })
})
