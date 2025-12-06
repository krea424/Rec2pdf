import React, { useCallback, useEffect, useState } from "react";
import ArchiveLayout from "../features/archive/ArchiveLayout";
import ShareModal from "../components/ShareModal"; // <--- 1. IMPORTA IL MODALE
import { useAppContext } from "../hooks/useAppContext";
import { RefreshCw } from "../components/icons";

const LibraryPage = () => {
  const {
    normalizedBackendUrl,
    fetchBody,
    handleOpenLibraryFile,
    handleOpenHistoryMd,
    workspaces,
    session
  } = useAppContext();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // --- STATO PER IL MODALE SHARE ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);

  // --- FETCH DATA ---
  const loadDocuments = useCallback(async () => {
    if (!normalizedBackendUrl || !session?.user?.id) return;
    setLoading(true);
    try {
      const result = await fetchBody(`${normalizedBackendUrl}/api/library`, { method: 'GET' });
      if (result.ok && result.data && Array.isArray(result.data.documents)) {
        setDocuments(result.data.documents);
        if (!selectedDoc && result.data.documents.length > 0) {
            setSelectedDoc(result.data.documents[0]);
        }
      }
    } catch (error) {
      console.error("Errore API Library:", error);
    } finally {
      setLoading(false);
    }
  }, [normalizedBackendUrl, fetchBody, selectedDoc, session]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // --- HANDLERS ---
  const handleSelect = (doc) => setSelectedDoc(doc);

  const handleOpenAction = () => {
    const pdfPathRaw = selectedDoc?.paths?.pdf || selectedDoc?.path;
    if (!pdfPathRaw) return;
    let pathWithBucket = pdfPathRaw.startsWith('processed-media') ? pdfPathRaw : `processed-media/${pdfPathRaw}`;
    handleOpenLibraryFile({ path: pathWithBucket, label: selectedDoc.title || 'Documento PDF' });
  };

  const handleOpenAudio = (audioPath) => {
    if (!audioPath) return;
    let pathWithBucket = audioPath.startsWith('audio-uploads') ? audioPath : `audio-uploads/${audioPath}`;
    handleOpenLibraryFile({ path: pathWithBucket, label: 'Registrazione Originale' });
  };

  const handleDownloadAudio = async (audioPath, fileName) => {
    if (!audioPath) return;
    let pathWithBucket = audioPath.startsWith('audio-uploads') ? audioPath : `audio-uploads/${audioPath}`;
    try {
        const cleanPath = pathWithBucket.replace(/^audio-uploads\//, '');
        const params = new URLSearchParams({ bucket: 'audio-uploads', path: cleanPath, download: 'true' });
        if (fileName) params.append('filename', fileName);
        const response = await fetch(`${normalizedBackendUrl}/api/file?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await response.json();
        if (data.ok && data.url) {
            const link = document.createElement('a');
            link.href = data.url;
            link.setAttribute('download', fileName || 'audio-download');
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    } catch (e) { console.error("Eccezione download audio:", e); }
  };

  const handleEdit = (doc) => {
    if (!doc) return;
    handleOpenHistoryMd({
        id: doc.id,
        title: doc.title,
        pdfPath: doc.paths?.pdf || doc.path,
        mdPath: doc.paths?.md,
        backendUrl: normalizedBackendUrl,
        workspace: { name: doc.workspace },
        prompt: { title: doc.intent },
        audioPath: doc.paths?.audio
    });
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo documento?")) return;
    const previousDocs = [...documents];
    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (selectedDoc?.id === docId) setSelectedDoc(null);
    try {
        const res = await fetchBody(`${normalizedBackendUrl}/api/library/${docId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(res.data?.message || "Errore");
    } catch (error) {
        alert("Errore eliminazione: " + error.message);
        setDocuments(previousDocs);
    }
  };

  // --- LOGICA SHARE AGGIORNATA ---
  
  // 1. Apre il modale
  const handleShareClick = (docId) => {
      setShareDocId(docId);
      setShareModalOpen(true);
  };

  // 2. Esegue l'invio (chiamato dal modale)
  const handleConfirmShare = async (email, message) => {
      setShareLoading(true);
      try {
          const res = await fetchBody(`${normalizedBackendUrl}/api/share`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  documentId: shareDocId, 
                  recipientEmail: email,
                  message: message 
              })
          });

          if (res.ok) {
              alert("✅ Email inviata con successo!");
              setShareModalOpen(false); // Chiude solo se successo
          } else {
              alert("Errore invio: " + (res.data?.message || "Sconosciuto"));
          }
      } catch (e) {
          alert("Errore di rete: " + e.message);
      } finally {
          setShareLoading(false);
      }
  };

  const handlePromoteDocument = (docId) => {
      alert("Funzionalità Knowledge Base in arrivo!");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-4 gap-4">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            🗂️ Archivio Intelligente
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-zinc-500" />}
        </h1>
        <div className="text-xs text-zinc-500">
            {documents.length} documenti indicizzati
        </div>
      </div>

      <div className="flex-1 min-h-0">
          <ArchiveLayout 
            documents={documents}
            workspaces={workspaces}
            selectedDoc={selectedDoc}
            onSelect={handleSelect}
            onOpen={handleOpenAction}
            onOpenAudio={handleOpenAudio}
            onDownloadAudio={handleDownloadAudio}
            onEdit={handleEdit}
            onDelete={handleDeleteDocument}
            onPromote={handlePromoteDocument}
            onShare={handleShareClick} // <--- Passiamo la funzione che apre il modale
            loading={loading}
          />
      </div>

      {/* --- MODALE SHARE --- */}
      <ShareModal 
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onConfirm={handleConfirmShare}
        loading={shareLoading}
      />
    </div>
  );
};

export default LibraryPage;