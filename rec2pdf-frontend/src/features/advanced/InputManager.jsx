import React, { useState, useEffect } from "react";
import { 
  Folder, 
  Settings, 
  FileText, 
  Image as ImageIcon, 
  RefreshCw, 
  Trash2, 
  ChevronDown, 
  LinkIcon,
  Users
} from "../../components/icons";
import { classNames } from "../../utils/classNames";
import { Button } from "../../components/ui/Button";

// Componente Helper per le Card di Input (Stile Uniformato)
const InputCard = ({ label, icon: Icon, children, className, action }) => (
  <div className={classNames(
    "flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#121214] p-5 transition-all hover:border-white/20",
    className
  )}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {action}
    </div>
    <div className="flex-1">
      {children}
    </div>
  </div>
);

const InputManager = ({ context }) => {
  const {
    workspaces,
    workspaceSelection,
    handleSelectWorkspaceForPipeline,
    handleSelectProjectForPipeline,
    handleCreateProjectFromDraft,
    projectDraft,
    setProjectDraft,
    projectCreationMode,
    workspaceProjects,
    activeWorkspace,
    
    // Profili
    activeWorkspaceProfiles,
    workspaceProfileSelection,
    applyWorkspaceProfile,
    clearWorkspaceProfile,
    workspaceProfileLocked,

    // Template
    pdfTemplates,
    pdfTemplateSelection,
    handleSelectPdfTemplate,
    clearPdfTemplateSelection,

    // Logo & Slug
    customPdfLogo,
    setCustomPdfLogo,
    slug,
    setSlug,
    
    // Utils
    destDir,
    setDestDir,
    handleRefreshWorkspaces,
    refreshPdfTemplates
  } = context;

  // Gestione Logo
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) setCustomPdfLogo(file);
  };

  return (
    <div className="space-y-4">
      
      {/* RIGA 1: WORKSPACE & PROGETTO (Full Width) */}
      <InputCard label="Destinazione (Workspace & Progetto)" icon={Folder}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Select Workspace */}
            <div className="relative">
                <select
                    value={workspaceSelection.workspaceId || ""}
                    onChange={(e) => handleSelectWorkspaceForPipeline(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                    <option value="">Seleziona Workspace...</option>
                    {workspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>

            {/* Select Progetto */}
            <div className="relative">
                {projectCreationMode ? (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={projectDraft}
                            onChange={(e) => setProjectDraft(e.target.value)}
                            placeholder="Nome nuovo progetto..."
                            className="w-full rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-3 text-sm text-white placeholder-indigo-300/50 focus:outline-none"
                            autoFocus
                        />
                        <Button size="sm" variant="primary" onClick={handleCreateProjectFromDraft}>Salva</Button>
                    </div>
                ) : (
                    <div className="relative">
                        <select
                            value={workspaceSelection.projectId || ""}
                            onChange={(e) => handleSelectProjectForPipeline(e.target.value)}
                            disabled={!workspaceSelection.workspaceId}
                            className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white disabled:opacity-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="">Seleziona Progetto...</option>
                            {workspaceProjects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            <option value="__new__">+ Crea Nuovo Progetto</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    </div>
                )}
            </div>
        </div>
        <div className="mt-3 flex justify-end">
            <button onClick={handleRefreshWorkspaces} className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-300 transition-colors">
                <RefreshCw className="h-3 w-3" /> Aggiorna Lista
            </button>
        </div>
      </InputCard>

      {/* RIGA 2: PROFILO, TEMPLATE, CARTELLA (Griglia a 3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          
          {/* 1. PROFILO */}
          <InputCard 
            label="Profilo Preconfigurato" 
            icon={Users}
            action={
                workspaceProfileSelection.profileId && (
                    <button onClick={clearWorkspaceProfile} className="text-zinc-500 hover:text-rose-400">
                        <Trash2 className="h-4 w-4" />
                    </button>
                )
            }
          >
             <div className="relative">
                <select
                    value={workspaceProfileSelection.profileId || ""}
                    onChange={(e) => applyWorkspaceProfile(e.target.value, { workspaceId: workspaceSelection.workspaceId })}
                    disabled={!workspaceSelection.workspaceId}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
                >
                    <option value="">Nessun profilo (Manuale)</option>
                    {activeWorkspaceProfiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500 leading-tight">
                Carica automaticamente template e logo salvati nel workspace.
            </p>
          </InputCard>

          {/* 2. TEMPLATE PDF */}
          <InputCard 
            label="Template Grafico" 
            icon={FileText}
            action={
                <button onClick={refreshPdfTemplates} className="text-zinc-500 hover:text-white">
                    <RefreshCw className="h-3 w-3" />
                </button>
            }
          >
             <div className="relative">
                <select
                    value={pdfTemplateSelection.fileName || ""}
                    onChange={(e) => handleSelectPdfTemplate(e.target.value)}
                    disabled={workspaceProfileLocked} // Disabilitato se il profilo comanda
                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed focus:border-indigo-500 focus:outline-none"
                >
                    <option value="">Default (Standard)</option>
                    {pdfTemplates.map((t) => (
                        <option key={t.fileName} value={t.fileName}>
                            {t.name || t.fileName}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
            {workspaceProfileLocked && (
                <p className="mt-2 text-[11px] text-indigo-400 flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> Gestito dal profilo attivo
                </p>
            )}
          </InputCard>

          {/* 3. CARTELLA OUTPUT */}
          <InputCard label="Cartella Output" icon={Folder}>
             <input 
                type="text" 
                value={destDir}
                onChange={(e) => setDestDir(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none font-mono"
             />
             <p className="mt-2 text-[11px] text-zinc-500 truncate" title={destDir}>
                Percorso locale dove salvare i file.
             </p>
          </InputCard>
      </div>

      {/* RIGA 3: SLUG & LOGO */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          
          {/* SLUG */}
          <InputCard label="Nome File (Slug)" icon={FileText}>
             <input 
                type="text" 
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="es. verbale_riunione_q3"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none font-mono"
             />
          </InputCard>

          {/* LOGO */}
          <InputCard 
            label="Logo Personalizzato" 
            icon={ImageIcon}
            action={
                customPdfLogo && (
                    <button onClick={() => setCustomPdfLogo(null)} className="text-xs text-rose-400 hover:underline">
                        Rimuovi
                    </button>
                )
            }
          >
             <div className="relative">
                <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={workspaceProfileLocked}
                />
                <div className={classNames(
                    "w-full rounded-xl border border-dashed px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors",
                    workspaceProfileLocked ? "border-white/5 bg-white/5 text-zinc-600 cursor-not-allowed" : "border-white/20 bg-black/20 text-zinc-400 hover:bg-white/5 hover:border-white/30"
                )}>
                    {customPdfLogo ? (
                        <span className="text-emerald-400 font-medium truncate">
                            {customPdfLogo.name || customPdfLogo.label || "Logo Caricato"}
                        </span>
                    ) : (
                        <span>Clicca per caricare un logo</span>
                    )}
                </div>
             </div>
          </InputCard>

      </div>

    </div>
  );
};

export default InputManager;