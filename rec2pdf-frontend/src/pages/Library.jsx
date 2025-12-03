import React, { useCallback, useEffect, useState } from "react";
import ArchiveLayout from "../features/archive/ArchiveLayout";
import { useAppContext } from "../hooks/useAppContext";
import { RefreshCw } from "../components/icons";

// --- ADAPTER: Trasforma i dati grezzi in "Documenti Parlanti" ---
const normalizeDocument = (rawFile, source = 'cloud') => {
  const meta = rawFile.metadata || {};
  
  return {
    id: rawFile.id || rawFile.name,
    name: rawFile.name,
    
    // Dati "Parlanti" (Business Logic) con fallback per i vecchi file
    title: meta.customTitle || rawFile.name.replace(/^documento_/, '').replace(/_/g, ' '),
    summary: meta.summary || "Documento generato prima dell'aggiornamento archivio.",
    intent: meta.intent || "GENERIC",
    status: meta.status || "Completed",
    workspace: meta.workspaceName || "Archivio Storico",
    project: meta.projectName || "",
    author: meta.author || "AI",
    
    // Dati Tecnici
    created_at: rawFile.created_at || rawFile.updated_at || new Date().toISOString(),
    size: rawFile.metadata?.size || 0,
    path: rawFile.name, // Questo è il nome file relativo al prefisso richiesto
    bucket: 'processed-media',
    source: source
  };
};

const LibraryPage = () => {
  const {
    normalizedBackendUrl,
    fetchBody,
    handleOpenLibraryFile,
    workspaces,
    session // <--- IMPORTANTE: Ci serve la sessione per l'ID utente
  } = useAppContext();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // --- FETCH DATA ---
  const loadDocuments = useCallback(async () => {
    if (!normalizedBackendUrl || !session?.user?.id) return;
    
    setLoading(true);
    try {
      // 1. Costruiamo il percorso specifico dell'utente
      // La struttura è: processed-media (bucket) / processed / USER_ID / files...
      const userPrefix = `processed/${session.user.id}`;
      
      // 2. Chiamata API con il prefisso corretto
      const result = await fetchBody(
        `${normalizedBackendUrl}/api/storage?bucket=processed-media&prefix=${encodeURIComponent(userPrefix)}`, 
        { method: 'GET' }
      );

      if (result.ok && Array.isArray(result.data?.files)) {
        const normalized = result.data.files
            .filter(f => f.name.endsWith('.pdf')) // Filtra solo i PDF
            .map(f => {
                // Il path restituito da Supabase dentro una cartella è solo il nome file.
                // Ma per aprirlo ci serve il path completo relativo al bucket.
                const fullObjectPath = `${userPrefix}/${f.name}`;
                const doc = normalizeDocument(f, 'cloud');
                doc.path = fullObjectPath; // Sovrascriviamo con il path completo per il download
                return doc;
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
        setDocuments(normalized);
        
        // Seleziona il primo se non c'è selezione
        if (!selectedDoc && normalized.length > 0) {
            setSelectedDoc(normalized[0]);
        }
      } else {
          console.warn("Nessun file trovato o errore API:", result);
      }
    } catch (error) {
      console.error("Errore caricamento library:", error);
    } finally {
      setLoading(false);
    }
  }, [normalizedBackendUrl, fetchBody, selectedDoc, session]);

  // Carica all'avvio
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // --- HANDLERS ---
  const handleSelect = (doc) => {
    setSelectedDoc(doc);
  };

  const handleOpenAction = () => {
    if (selectedDoc) {
        handleOpenLibraryFile({
            bucket: selectedDoc.bucket,
            path: selectedDoc.path, 
            label: selectedDoc.title
        });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-4 gap-4">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            🗂️ Archivio Intelligente
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-zinc-500" />}
        </h1>
        <div className="text-xs text-zinc-500">
            {documents.length} documenti indicizzati
        </div>
      </div>

      {/* Layout */}
      <div className="flex-1 min-h-0">
          <ArchiveLayout 
            documents={documents}
            workspaces={workspaces}
            selectedDoc={selectedDoc}
            onSelect={handleSelect}
            onOpen={handleOpenAction}
            loading={loading}
          />
      </div>
    </div>
  );
};

export default LibraryPage;