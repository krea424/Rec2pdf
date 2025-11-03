import { describe, expect, it } from 'vitest';

import { appendWorkspaceProfileDetails } from '../App.jsx';

describe('appendWorkspaceProfileDetails', () => {
  it('allega i dettagli del template anche senza logo del profilo', () => {
    const formData = new FormData();
    formData.append('workspaceId', 'ws_123');

    appendWorkspaceProfileDetails(formData, {
      selection: { workspaceId: 'ws_123', profileId: 'prof_abc' },
      profile: {
        id: 'prof_abc',
        label: 'Profilo verbale',
        pdfTemplate: 'verbale_meeting.html',
        pdfTemplateType: 'html',
        pdfTemplateCss: 'verbale_meeting.css',
      },
      logoDescriptor: null,
      backendUrl: 'https://backend.example.com',
    });

    expect(formData.get('workspaceProfileId')).toBe('prof_abc');
    expect(formData.get('workspaceProfileTemplate')).toBe('verbale_meeting.html');
    expect(formData.get('workspaceProfileTemplateType')).toBe('html');
    expect(formData.get('workspaceProfileTemplateCss')).toBe('verbale_meeting.css');
    expect(formData.get('workspaceProfileLabel')).toBe('Profilo verbale');
    expect(formData.has('workspaceProfileLogoPath')).toBe(false);
    expect(formData.has('workspaceProfileLogoDownloadUrl')).toBe(false);
  });
});
