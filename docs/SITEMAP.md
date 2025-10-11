# Sitemap applicativa

```
/
├── (autenticazione)
│   ├── Sessione valida → AppShell
│   └── Sessione assente → LoginPage (`src/components/LoginPage.jsx`)
└── AppShell (`src/components/layout/AppShell.jsx`)
    ├── /create → CreatePage (`src/pages/Create.jsx`)
    │   └── include pipeline audio→PDF, workspace e prompt
    ├── /library → LibraryPage (`src/pages/Library.jsx`)
    │   ├── Tab Cronologia → WorkspaceNavigator (`src/components/WorkspaceNavigator.jsx`)
    │   └── Tab Cloud library → CloudLibraryPanel (`src/components/CloudLibraryPanel.jsx`)
    ├── /editor → EditorPage (`src/pages/Editor.jsx`)
    │   └── MarkdownEditorModal (`src/components/MarkdownEditorModal.jsx`)
    └── * → redirect /create
```

- AppShell contiene navigazione primaria (Create, Library) e SettingsDrawer.
- Editor è accessibile via routing ma presentato come modal a piena pagina.
