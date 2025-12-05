import React, { useCallback, useEffect, useState } from "react";
import ArchiveLayout from "../features/archive/ArchiveLayout";
import { useAppContext } from "../hooks/useAppContext";
import { RefreshCw } from "../components/icons";

// ... (importazioni invariate)

const normalizeDocument = (rawFile, source = 'cloud') => {
  const meta = rawFile.metadata || {};
  
  // Tentativo di estrarre la data dal nome file (es. 20251204T09264_meeting.pdf)
  let dateFromTitle = null;
  const dateMatch = rawFile.name.match(/(\d{8}T\d{5})/);
  if (dateMatch) {
      // Parsing rudimentale YYYYMMDDTHHMMM -> Date
      // (Implementazione robusta omessa per brevità, ma utile)
  }

  // Costruzione Path Audio (Euristica: stesso nome ma estensione diversa)
  // Nota: Questo è un tentativo "best effort". In futuro useremo il DB.
  const audioPath = rawFile.name.replace(/\.pdf$/i, '.m4a'); // O .webm, .mp3...

  return {
    id: rawFile.id || rawFile.name,
    name: rawFile.name,
    
    // Dati "Parlanti"
    title: meta.customTitle || rawFile.name
        .replace(/^documento_/, '')
        .replace(/^\d{8}T\d{5}_/, '') // Rimuove timestamp
        .replace(/_/g, ' ')
        .replace(/\.pdf$/i, ''),
    
    summary: meta.summary || "Documento archiviato.",
    intent: meta.intent || (rawFile.name.includes('meeting') ? 'OPERATIONAL_UPDATE' : 'GENERIC_NOTE'),
    status: meta.status || "Completed",
    workspace: meta.workspaceName || "Archivio",
    project: meta.projectName || "",
    author: meta.author || "AI",
    
    // Dati Tecnici
    created_at: rawFile.created_at || rawFile.updated_at || new Date().toISOString(),
    size: rawFile.metadata?.size || 0,
    path: rawFile.name, 
    bucket: 'processed-media',
    
    // Asset Correlati (Nuovo!)
    audioPath: audioPath, // Passiamo questo al layout
    source: source
  };
};

// ... (resto del componente LibraryPage invariato per ora)

const LibraryPage = () => {
  const {
    normalizedBackendUrl,
    fetchBody,
    handleOpenLibraryFile,
    handleOpenHistoryMd, // <--- AGGIUNGI QUESTO
    workspaces,
    session // <--- IMPORTANTE: Ci serve la sessione per l'ID utente
  } = useAppContext();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

 // --- FETCH DATA (Versione DB) ---
 const loadDocuments = useCallback(async () => {
  if (!normalizedBackendUrl || !session?.user?.id) return;
  
  setLoading(true);
  try {
    // CHIAMATA AL NUOVO ENDPOINT
    const result = await fetchBody(`${normalizedBackendUrl}/api/library`, { method: 'GET' });

   // --- FIX QUI SOTTO: Aggiunto .data ---
   if (result.ok && result.data && Array.isArray(result.data.documents)) {
    const docs = result.data.documents; // Estraiamo l'array corretto
    setDocuments(docs);
    
    // Seleziona il primo se non c'è selezione
    if (!selectedDoc && docs.length > 0) {
        setSelectedDoc(docs[0]);
    }
  } else {
      console.warn("Errore caricamento library (formato imprevisto):", result);
  }
  } catch (error) {
    console.error("Errore API Library:", error);
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
    // Controllo robusto: verifichiamo se abbiamo i percorsi nuovi (dal DB)
    const pdfPathRaw = selectedDoc?.paths?.pdf || selectedDoc?.path;

    if (!pdfPathRaw) {
        console.warn("Nessun percorso PDF trovato per questo documento.");
        return;
    }

    // TRUCCO BUCKET: Come per l'audio, forziamo il bucket nel path
    // Il bucket dei PDF è 'processed-media'
    let pathWithBucket = pdfPathRaw;
    if (!pathWithBucket.startsWith('processed-media')) {
        pathWithBucket = `processed-media/${pathWithBucket}`;
    }

    handleOpenLibraryFile({
        // Non passiamo 'bucket' esplicitamente, lo lasciamo nel path
        path: pathWithBucket, 
        label: selectedDoc.title || 'Documento PDF'
    });
  };
  // ... dentro LibraryPage ...

  // ... handleOpenAudio esistente ...

  // NUOVA FUNZIONE: Gestisce il download forzato
  const handleDownloadAudio = async (audioPath, fileName) => {
    if (!audioPath) return;
    
    // Normalizzazione path come in handleOpenAudio
    let pathWithBucket = audioPath;
    if (!audioPath.startsWith('audio-uploads')) {
        pathWithBucket = `audio-uploads/${audioPath}`;
    }

    // Costruiamo l'URL chiamando il backend con ?download=true
    try {
        const bucket = 'audio-uploads'; 
        // Il backend si aspetta bucket e path separati nella query string
        // Estrarre il path puro (senza bucket iniziale se presente per l'API)
        // Nota: handleOpenLibraryFile fa parsing interno, qui facciamo manuale per il fetch
        const cleanPath = pathWithBucket.replace(/^audio-uploads\//, '');
        
        const params = new URLSearchParams({ 
            bucket: bucket, 
            path: cleanPath,
            download: 'true' // <--- IL TRUCCO
        });
        
        if (fileName) params.append('filename', fileName);

        const response = await fetch(`${normalizedBackendUrl}/api/file?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        const data = await response.json();
        
        if (data.ok && data.url) {
            // Trigger download creando un link invisibile
            const link = document.createElement('a');
            link.href = data.url;
            // Non serve impostare download attribute qui perché lo fa l'header del server, 
            // ma male non fa
            link.setAttribute('download', fileName || 'audio-download');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } else {
            console.error("Errore download:", data.message);
            alert("Errore nel recupero del file audio.");
        }
    } catch (e) {
        console.error("Eccezione download audio:", e);
    }
  };
 // Gestore per l'apertura dell'audio
 const handleOpenAudio = (audioPath) => {
  if (!audioPath) return;
  
  // TRUCCO: Prependiamo il bucket al path con uno slash.
  // Il backend (parseStoragePath) vedrà "audio-uploads/uploads/..."
  // e capirà che il primo segmento è il bucket.
  // Nota: Se audioPath inizia già con "audio-uploads/", non lo aggiungiamo.
  
  let pathWithBucket = audioPath;
  if (!audioPath.startsWith('audio-uploads')) {
      pathWithBucket = `audio-uploads/${audioPath}`;
  }
  
  handleOpenLibraryFile({
    // Non passiamo 'bucket' esplicitamente qui perché App.jsx sembra ignorarlo
    // Lo passiamo "nascosto" nel path
    path: pathWithBucket,         
    label: 'Registrazione Originale'
  });
};
  // Gestore per la modifica del documento
  const handleEdit = (doc) => {
    if (!doc) return;
    
    // Ricostruiamo l'oggetto "entry" compatibile con l'Editor e la vecchia cronologia
    const editorEntry = {
        id: doc.id,
        title: doc.title,
        // Mappiamo i percorsi corretti
        pdfPath: doc.paths?.pdf || doc.path, // Fallback per compatibilità
        mdPath: doc.paths?.md,
        // Backend URL è necessario per le chiamate API dell'editor
        backendUrl: normalizedBackendUrl,
        // Metadati extra utili
        workspace: { name: doc.workspace },
        prompt: { title: doc.intent }, // Usiamo l'intento come titolo prompt se manca
        // Se abbiamo l'audio, lo passiamo (utile per future feature di riascolto in editor)
        audioPath: doc.paths?.audio
    };

    // Chiamiamo la funzione globale dell'App che apre l'editor
    handleOpenHistoryMd(editorEntry);
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
            onOpenAudio={handleOpenAudio} // <--- AGGIUNGI QUESTA RIGA
            onDownloadAudio={handleDownloadAudio} // <--- NUOVA PROP
            onEdit={handleEdit} // <--- AGGIUNGI QUESTO
            loading={loading}
          />
      </div>
    </div>
  );
};

export default LibraryPage;