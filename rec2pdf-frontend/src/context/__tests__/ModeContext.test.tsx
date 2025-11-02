import { render, screen, waitFor } from '@testing-library/react'
import { ModeProvider, useMode } from '../ModeContext'
import { AnalyticsProvider } from '../AnalyticsContext'

describe('ModeContext', () => {
  const trackEvent = vi.fn()
  const trackToggleEvent = vi.fn()

  const Consumer = () => {
    const { flags, hasFlag } = useMode()
    return (
      <div>
        <span data-testid="has-advanced">{hasFlag('MODE_ADVANCED') ? 'yes' : 'no'}</span>
        <span data-testid="has-advanced-v2">{hasFlag('MODE_ADVANCED_V2') ? 'yes' : 'no'}</span>
        <span data-testid="flag-count">{Array.from(flags).length}</span>
      </div>
    )
  }

  beforeEach(() => {
    trackEvent.mockClear()
    trackToggleEvent.mockClear()
  })

  it('propagates feature flags from the session and reacts to updates', async () => {
    const { rerender } = render(
      <AnalyticsProvider value={{ trackEvent, trackToggleEvent }}>
        <ModeProvider
          session={{
            user: {
              id: 'user-1',
              app_metadata: { feature_flags: ['MODE_BASE', 'MODE_ADVANCED', 'MODE_ADVANCED_V2'] },
            },
          } as any}
        >
          <Consumer />
        </ModeProvider>
      </AnalyticsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-advanced')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-advanced-v2')).toHaveTextContent('yes')
    })

    rerender(
      <AnalyticsProvider value={{ trackEvent, trackToggleEvent }}>
        <ModeProvider
          session={{
            user: {
              id: 'user-1',
              app_metadata: { feature_flags: ['MODE_BASE'] },
            },
          } as any}
        >
          <Consumer />
        </ModeProvider>
      </AnalyticsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-advanced')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-advanced-v2')).toHaveTextContent('no')
    })
  })

  it('emits a flag exposure event once per session for tracked flags', async () => {
    const { rerender } = render(
      <AnalyticsProvider value={{ trackEvent, trackToggleEvent }}>
        <ModeProvider
          session={{
            user: {
              id: 'user-2',
              app_metadata: {
                feature_flags: ['MODE_BASE', 'MODE_ADVANCED', 'MODE_ADVANCED_V2'],
              },
            },
          } as any}
        >
          <Consumer />
        </ModeProvider>
      </AnalyticsProvider>,
    )

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith(
        'mode.flag_exposed',
        expect.objectContaining({ flag: 'MODE_ADVANCED_V2', mode: 'base' }),
      )
    })

    rerender(
      <AnalyticsProvider value={{ trackEvent, trackToggleEvent }}>
        <ModeProvider
          session={{
            user: {
              id: 'user-2',
              app_metadata: {
                feature_flags: ['MODE_BASE', 'MODE_ADVANCED', 'MODE_ADVANCED_V2'],
              },
            },
          } as any}
        >
          <Consumer />
        </ModeProvider>
      </AnalyticsProvider>,
    )

    await waitFor(() => {
      const exposures = trackEvent.mock.calls.filter(([eventName]) => eventName === 'mode.flag_exposed')
      expect(exposures).toHaveLength(1)
    })
  })
})
