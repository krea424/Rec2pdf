import { test, expect } from '@playwright/test'
const promptsPayload = {
  ok: true,
  prompts: [
    {
      id: 'prompt-1',
      legacyId: 'prompt-1',
      supabaseId: '11111111-2222-3333-4444-555555555555',
      slug: 'meeting-recap',
      title: 'Meeting recap',
      summary: 'Template di esempio',
      description: 'Template di esempio',
      persona: 'PM',
      color: '#6366f1',
      tags: ['meeting'],
      cueCards: [],
      checklist: { sections: ['Introduzione'], focusPrompts: ['Sintesi meeting'] },
      focusPrompts: ['Sintesi meeting'],
      markdownRules: { tone: 'Professionale' },
      pdfRules: { layout: 'standard' },
      builtIn: false,
      createdAt: '2024-07-28T12:00:00.000Z',
      updatedAt: '2024-07-28T12:30:00.000Z',
    },
  ],
}

const workspacesPayload = {
  workspaces: [
    {
      id: 'ws-1',
      slug: 'acme-workspace',
      name: 'ACME Workspace',
      metadata: {
        client: 'ACME Corp',
        color: '#6366f1',
      },
      default_statuses: ['Bozza', 'In lavorazione', 'Completato'],
      projects: JSON.stringify([
        {
          id: 'proj-1',
          name: 'Kickoff',
          color: '#6366f1',
          statuses: ['Bozza', 'Completato'],
          created_at: '2024-07-01T09:00:00.000Z',
          updated_at: '2024-07-05T10:00:00.000Z',
        },
      ]),
      profiles: [],
      created_at: '2024-07-01T09:00:00.000Z',
      updated_at: '2024-07-10T09:30:00.000Z',
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
  test.beforeEach(async ({ page }) => {
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
  })

  test('uploads audio and completes pipeline with mocked APIs', async ({ page }) => {
    await page.goto('/create')

    const fakeAudioFile = {
      name: 'sample.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('RIFF....WAVEfmt '),
    }
    await page.setInputFiles('input[type="file"][accept="audio/*"]', fakeAudioFile)

    const startButton = page.getByRole('button', { name: 'Ottieni PDF', exact: true })
    await expect(startButton).toBeEnabled()

    await startButton.click()

    const downloadButton = page.getByRole('button', { name: 'Scarica PDF', exact: true })
    await expect(downloadButton).toBeVisible()
  })

  test('espone le insight sui prompt nelle impostazioni', async ({ page }) => {
    await page.goto('/create')

    await page.getByRole('button', { name: 'Impostazioni' }).click()

    await page.getByRole('button', { name: 'Prompt' }).click()

    await expect(page.getByText(/Prompt attivo/i)).toBeVisible()
  })
})
