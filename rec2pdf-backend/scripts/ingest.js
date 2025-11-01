#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { randomUUID, createHash } = require('crypto');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const yaml = require('js-yaml');
const { getAIService } = require('../services/aiService');
const {
    resolveProvider: resolveAiProvider,
    sanitizeProviderInput: sanitizeAiProviderInput,
} = require('../services/aiProviders');

const PROJECT_ROOT = path.resolve(__dirname, '..');

loadEnv();

const PROJECT_SCOPE_NAMESPACE = 'rec2pdf:knowledge:project:';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const args = process.argv.slice(2);
const workspaceId = parseWorkspaceId(args);
const rawProjectId = parseProjectId(args);
const { canonicalId: projectScopeId, originalId: projectOriginalId } = resolveProjectScopeIdentifiers(rawProjectId);

if (!workspaceId) {
    console.error('Errore: specifica il workspace tramite --workspaceId <id>');
    process.exit(1);
}

const knowledgePathSegments = projectOriginalId ? [workspaceId, projectOriginalId] : [workspaceId];
const knowledgeDirCandidates = [
    path.resolve(PROJECT_ROOT, 'knowledge_sources', ...knowledgePathSegments),
    path.resolve(PROJECT_ROOT, '..', 'knowledge_sources', ...knowledgePathSegments)
];

const knowledgeDir = knowledgeDirCandidates.find((candidate) => existsSync(candidate));

if (!knowledgeDir) {
    console.error(
        `Errore: impossibile trovare i contenuti per ${projectOriginalId ? `il progetto ${projectOriginalId} del ` : ''}` +
        `workspace ${workspaceId}. Crea knowledge_sources/${knowledgePathSegments.join('/')}/ in rec2pdf-backend/ ` +
        `oppure nella root del progetto con i file da indicizzare.`
    );
    process.exit(1);
}

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(`Errore: variabili mancanti (${missingEnv.join(', ')}). Aggiungile al file .env o all'ambiente.`);
    process.exit(1);
}

const embeddingProviderArg = parseEmbeddingProvider(args);
let embeddingProvider;
try {
    embeddingProvider = resolveAiProvider('embedding', embeddingProviderArg);
} catch (error) {
    console.error(`Errore: ${error.message}`);
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
let aiEmbedder;
try {
    aiEmbedder = getAIService(embeddingProvider.id, embeddingProvider.apiKey, embeddingProvider.model);
} catch (error) {
    console.error(`Errore: impossibile inizializzare il client ${embeddingProvider.id}. ${error.message}`);
    process.exit(1);
}

console.log(`ℹ️  Provider embedding attivo: ${embeddingProvider.label} (${embeddingProvider.id})`);

const CHUNK_SIZE = 250;
const CHUNK_OVERLAP = 50;
const BATCH_SIZE = 50;

(async () => {
    try {
        const files = await collectSourceFiles(knowledgeDir, knowledgeDir);

        if (files.length === 0) {
            console.error(`Errore: nessun file .txt o .md trovato in knowledge_sources/${workspaceId}/`);
            process.exit(1);
        }

        const chunks = [];

        for (const file of files) {
            const content = await fs.readFile(file.absolutePath, 'utf8');
            const { body, frontMatter } = parseFrontMatter(content, file.absolutePath);
            const normalized = normalizeWhitespace(body);
            const metadata = buildMetadata(file.relativePath, frontMatter);
            const fileChunks = createChunks(normalized, CHUNK_SIZE, CHUNK_OVERLAP).map((chunkContent, index) => ({
                id: randomUUID(),
                workspace_id: workspaceId,
                project_id: projectScopeId || null,
                content: chunkContent,
                metadata: {
                    ...metadata,
                    projectId: projectScopeId || null,
                    projectOriginalId: projectOriginalId || null,
                },
                order: index
            }));

            for (const chunk of fileChunks) {
                if (chunk.content.trim().length > 0) {
                    chunks.push(chunk);
                }
            }
        }

        if (chunks.length === 0) {
            console.error('Errore: impossibile creare chunk con il contenuto disponibile.');
            process.exit(1);
        }

        let processed = 0;

        for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
            const batch = chunks.slice(start, start + BATCH_SIZE);
            const embeddings = await aiEmbedder.generateEmbedding(batch.map((item) => item.content));

            if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
                throw new Error('Risposta embedding non valida');
            }

            const payload = batch.map((item, index) => ({
                id: item.id,
                workspace_id: item.workspace_id,
                project_id: item.project_id,
                content: item.content,
                embedding: Array.isArray(embeddings[index]) ? embeddings[index] : [],
                metadata: item.metadata
            }));

            const { error } = await supabase.from('knowledge_chunks').insert(payload);
            if (error) {
                throw new Error(`Inserimento Supabase fallito: ${error.message}`);
            }

            processed += payload.length;
            console.log(`Inseriti ${processed}/${chunks.length} chunk...`);
        }

        if (projectScopeId) {
            console.log(
                `Completato: ${processed} chunk salvati per il progetto ${projectOriginalId || projectScopeId} del workspace ${workspaceId}.`
            );
        } else {
            console.log(`Completato: ${processed} chunk salvati per il workspace ${workspaceId}.`);
        }
    } catch (error) {
        console.error(error.message || error);
        process.exit(1);
    }
})();

function loadEnv() {
    const envPaths = [
        path.join(PROJECT_ROOT, '.env.local'),
        path.join(PROJECT_ROOT, '.env'),
        path.join(process.cwd(), '.env')
    ];

    for (const envPath of envPaths) {
        dotenv.config({ path: envPath, override: false });
    }
}

function parseWorkspaceId(args) {
    let workspaceId;
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--workspaceId' || arg === '--workspace-id') {
            workspaceId = args[index + 1];
            break;
        }
        if (arg.startsWith('--workspaceId=')) {
            workspaceId = arg.split('=')[1];
            break;
        }
        if (arg.startsWith('--workspace-id=')) {
            workspaceId = arg.split('=')[1];
            break;
        }
    }
    return workspaceId;
}

function parseProjectId(args) {
    let projectId;
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--projectId' || arg === '--project-id') {
            projectId = args[index + 1];
            break;
        }
        if (arg.startsWith('--projectId=')) {
            projectId = arg.split('=')[1];
            break;
        }
        if (arg.startsWith('--project-id=')) {
            projectId = arg.split('=')[1];
            break;
        }
    }
    return projectId ? String(projectId).trim() : undefined;
}

function parseEmbeddingProvider(args) {
    let provider;
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--embeddingProvider' || arg === '--embedding-provider') {
            provider = args[index + 1];
            break;
        }
        if (arg.startsWith('--embeddingProvider=')) {
            provider = arg.split('=')[1];
            break;
        }
        if (arg.startsWith('--embedding-provider=')) {
            provider = arg.split('=')[1];
            break;
        }
    }
    return sanitizeAiProviderInput(provider);
}

function sanitizeProjectIdentifier(value) {
    if (Array.isArray(value) && value.length) {
        return sanitizeProjectIdentifier(value[0]);
    }
    if (value === null || value === undefined) {
        return '';
    }
    const raw = typeof value === 'string' ? value : String(value);
    const trimmed = raw.trim();
    if (!trimmed) {
        return '';
    }
    const lowered = trimmed.toLowerCase();
    if (lowered === 'null' || lowered === 'undefined' || trimmed === '[object Object]') {
        return '';
    }
    return trimmed;
}

function deterministicUuidFromString(value) {
    const hash = createHash('sha1').update(PROJECT_SCOPE_NAMESPACE).update(value).digest();
    const bytes = Buffer.from(hash.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalizeProjectScopeId(value) {
    const sanitized = sanitizeProjectIdentifier(value);
    if (!sanitized) {
        return '';
    }
    const normalized = sanitized.toLowerCase();
    if (UUID_REGEX.test(normalized)) {
        return normalized;
    }
    return deterministicUuidFromString(normalized);
}

function resolveProjectScopeIdentifiers(value) {
    const sanitized = sanitizeProjectIdentifier(value);
    if (!sanitized) {
        return { canonicalId: '', originalId: '' };
    }
    return {
        canonicalId: canonicalizeProjectScopeId(sanitized),
        originalId: sanitized,
    };
}

async function collectSourceFiles(dir, baseDir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const nested = await collectSourceFiles(fullPath, baseDir);
            files.push(...nested);
        } else if (entry.isFile() && hasSupportedExtension(entry.name)) {
            files.push({
                absolutePath: fullPath,
                relativePath: path.relative(baseDir, fullPath)
            });
        }
    }

    return files;
}

function hasSupportedExtension(filename) {
    return ['.txt', '.md'].includes(path.extname(filename).toLowerCase());
}

function normalizeWhitespace(text) {
    return text.replace(/\r\n/g, '\n').replace(/[\t\f\v]+/g, ' ').trim();
}

function createChunks(text, chunkSize, overlap) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [];
    }

    const chunks = [];
    const step = Math.max(chunkSize - overlap, 1);

    for (let index = 0; index < words.length; index += step) {
        const slice = words.slice(index, index + chunkSize);
        if (slice.length === 0) {
            continue;
        }
        chunks.push(slice.join(' '));
        if (slice.length < chunkSize) {
            break;
        }
    }

    return chunks;
}

function parseFrontMatter(rawContent, filePath) {
    const result = { body: rawContent, frontMatter: null };
    if (!rawContent) {
        return result;
    }

    const frontMatterPattern = /^\ufeff?---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/;
    const match = rawContent.match(frontMatterPattern);

    if (!match) {
        return result;
    }

    const [, frontMatterBlock] = match;
    const body = rawContent.slice(match[0].length);

    if (!frontMatterBlock.trim()) {
        return { body, frontMatter: null };
    }

    try {
        const parsed = yaml.load(frontMatterBlock);
        if (parsed && typeof parsed === 'object') {
            return { body, frontMatter: parsed };
        }
    } catch (error) {
        console.warn(`Impossibile parsare il front matter YAML per ${filePath}: ${error.message}`);
    }

    return { body, frontMatter: null };
}

function buildMetadata(relativePath, frontMatter) {
    if (frontMatter && typeof frontMatter === 'object' && !Array.isArray(frontMatter)) {
        return { source: relativePath, ...frontMatter };
    }

    return { source: relativePath };
}
