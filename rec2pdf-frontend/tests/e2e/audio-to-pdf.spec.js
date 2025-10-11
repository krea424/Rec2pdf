import { test, expect } from '@playwright/test'
const promptsPayload = {
  prompts: [
    {
      id: 'prompt-1',
      slug: 'meeting-recap',
      title: 'Meeting recap',
      description: 'Template di esempio',
      persona: 'PM',
      color: '#6366f1',
      tags: ['meeting'],
      cueCards: [],
      checklist: { sections: [] },
    },
  ],
}

const workspacesPayload = {
  workspaces: [
    {
      id: 'ws-1',
      name: 'ACME Workspace',
      client: 'ACME Corp',
      color: '#6366f1',
      statusCatalog: ['Bozza', 'In lavorazione', 'Completato'],
      projects: [
        { id: 'proj-1', name: 'Kickoff', color: '#6366f1', statuses: ['Bozza', 'Completato'] },
      ],
      defaultStatuses: ['Bozza', 'In lavorazione', 'Completato'],
    },
  ],
}

const pipelineResponse = {
  pdfPath: '/output/report.pdf',
  mdPath: '/output/report.md',
  logs: ['Pipeline completata'],
  stageEvents: [
    { stage: 'upload', status: 'done', message: 'Upload completato' },
    { stage: 'transcribe', status: 'done', message: 'Trascrizione completata' },
    { stage: 'complete', status: 'done', message: 'Pipeline completata' },
  ],
  prompt: {
    id: 'prompt-1',
    title: 'Meeting recap',
    slug: 'meeting-recap',
    tags: ['meeting'],
    cueCards: [],
  },
}

test.describe('Audio to PDF flow', () => {
  test('uploads audio and completes pipeline with mocked APIs', async ({ page }) => {
    await page.route('**/api/*', async (route) => {
      const url = new URL(route.request().url())
      const { pathname } = url
      if (pathname.endsWith('/api/prompts')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(promptsPayload),
          headers: { 'content-type': 'application/json' },
        })
        return
      }
      if (pathname.endsWith('/api/workspaces')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(workspacesPayload),
          headers: { 'content-type': 'application/json' },
        })
        return
      }
      if (pathname.endsWith('/api/rec2pdf') && route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(pipelineResponse),
          headers: { 'content-type': 'application/json' },
        })
        return
      }
      if (pathname.endsWith('/api/health')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ status: 'ok' }), headers: { 'content-type': 'application/json' } })
        return
      }
      if (pathname.endsWith('/api/diag')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ logs: ['diagnostics ok'], message: '' }),
          headers: { 'content-type': 'application/json' },
        })
        return
      }
      await route.fulfill({
        status: 200,
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
    })

    await page.goto('/create')

    const fakeAudioFile = {
      name: 'sample.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('RIFF....WAVEfmt '),
    }
    await page.setInputFiles('input[type="file"][accept="audio/*"]', fakeAudioFile)

    const startButton = page.getByRole('button', { name: 'Avvia pipeline', exact: true })
    await expect(startButton).toBeEnabled()

    await startButton.click()

    const completionBanner = page.locator('main').getByText('Pipeline completata', { exact: true }).first()
    await expect(completionBanner).toBeVisible()
  })
})
