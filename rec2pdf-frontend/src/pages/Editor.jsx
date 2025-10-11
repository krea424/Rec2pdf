import MarkdownEditorModal from "../components/MarkdownEditorModal";
import { useAppContext } from "../hooks/useAppContext";

const EditorPage = () => {
  const context = useAppContext();
  const { theme, themes } = context;

  return (
    <MarkdownEditorModal
      open={context.mdEditor.open}
      title={context.mdEditor?.entry?.title || context.mdEditor?.entry?.slug || ""}
      path={context.mdEditor.path}
      value={context.mdEditor.content}
      onChange={context.handleMdEditorChange}
      onClose={context.handleMdEditorClose}
      onSave={context.handleMdEditorSave}
      onRepublish={context.handleRepublishFromEditor}
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
    />
  );
};

export default EditorPage;
