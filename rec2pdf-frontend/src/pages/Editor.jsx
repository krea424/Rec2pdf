import MarkdownEditorModal from "../components/MarkdownEditorModal";
import { useAppContext } from "../hooks/useAppContext";

const EditorPage = () => {
  const context = useAppContext();
  const { theme, themes, pdfTemplates } = context; // <--- AGGIUNTO pdfTemplates
  
  const renderedValue =
    typeof context.mdEditor.renderedContent === "string" && context.mdEditor.renderedContent.length
      ? context.mdEditor.renderedContent
      : context.mdEditor.content;
  const speakerMapHasNames = Boolean(context.speakerMapHasNames);

  return (
    <MarkdownEditorModal
      // ... props esistenti ...
      open={context.mdEditor.open}
      title={context.mdEditor?.entry?.title || context.mdEditor?.entry?.slug || ""}
      path={context.mdEditor.path}
      value={context.mdEditor.content}
      renderedValue={renderedValue}
      onChange={context.handleMdEditorChange}
      onClose={context.handleMdEditorClose}
      onSave={context.handleMdEditorSave}
      onRepublish={context.handleRepublishFromEditor}
      onRepublishWithSpeakers={context.handleRepublishFromEditorWithSpeakers}
      loading={context.mdEditor.loading}
      saving={context.mdEditor.saving}
      error={context.mdEditor.error}
      success={context.mdEditor.success}
      hasUnsavedChanges={context.mdEditorDirty}
      onOpenInNewTab={context.handleOpenMdInNewTab}
      onViewPdf={context.handleMdEditorViewPdf}
      canViewPdf={Boolean(context.mdEditor?.entry?.pdfPath)}
      busy={context.busy}
      lastAction={context.mdEditor.lastAction}
      themeStyles={themes[theme]}
      speakers={context.mdEditor?.speakers || []}
      speakerMap={context.mdEditor?.speakerMap || {}}
      onSpeakerMapChange={context.handleSpeakerMapChange}
      speakerMapHasNames={speakerMapHasNames}
      
      // --- NUOVA PROP ---
      availableTemplates={pdfTemplates} 
    />
  );
};

export default EditorPage;