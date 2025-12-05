import React, { useCallback, useEffect, useState } from "react";
import ArchiveLayout from "../features/archive/ArchiveLayout";
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

  // --- FETCH DATA (Corretto: Non dipende più da selectedDoc) ---
  const loadDocuments = useCallback(async () => {
    if (!normalizedBackendUrl || !session?.user?.id) return;
    
    setLoading(true);
    try {
      const result = await fetchBody(`${normalizedBackendUrl}/api/library`, { method: 'GET' });

      if (result.ok && result.data && Array.isArray(result.data.documents)) {
        const docs = result.data.documents;
        setDocuments(docs);
        
        // Logica di auto-selezione spostata qui, ma eseguita solo se non c'è nulla di selezionato
        // Usiamo il callback di stato per evitare dipendenze cicliche
        setSelectedDoc(prev => prev || (docs.length > 0 ? docs[0] : null));
      }
    } catch (error) {
      console.error("Errore API Library:", error);
    } finally {
      setLoading(false);
    }
  }, [normalizedBackendUrl, fetchBody, session]); // RIMOSSO selectedDoc dalle dipendenze!

  // Carica solo al mount o se cambia l'utente/backend
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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

  // --- GESTIONE ELIMINAZIONE (Optimistic UI) ---
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo documento?")) {
        return;
    }

    // 1. Aggiornamento Ottimistico: Rimuovi subito dalla lista locale
    const previousDocs = [...documents];
    const newDocs = documents.filter(d => d.id !== docId);
    setDocuments(newDocs);
    
    // 2. Gestione Selezione: Se ho cancellato quello attivo, seleziono il primo disponibile o null
    if (selectedDoc?.id === docId) {
        setSelectedDoc(newDocs.length > 0 ? newDocs[0] : null);
    }

    try {
        // 3. Chiamata API in background
        const res = await fetchBody(`${normalizedBackendUrl}/api/library/${docId}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            throw new Error(res.data?.message || "Errore durante l'eliminazione");
        }
        // NON ricarichiamo la lista qui (loadDocuments), ci fidiamo dell'aggiornamento locale.
    } catch (error) {
        console.error("Delete error:", error);
        alert("Impossibile eliminare il documento: " + error.message);
        // 4. Rollback in caso di errore
        setDocuments(previousDocs);
        if (selectedDoc?.id === docId) setSelectedDoc(previousDocs.find(d => d.id === docId));
    }
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
            loading={loading}
          />
      </div>
    </div>
  );
};

export default LibraryPage;