import { textArtifact } from './text/client';
import { researchUpdateArtifact } from './research_update/client';
import { textDocumentHandler } from './text/server';
import { researchUpdateDocumentHandler } from './research_update/server';

export const clientArtifacts = {
	text: textArtifact,
	research_update: researchUpdateArtifact,
};

export const serverArtifacts = {
	text: textDocumentHandler,
	research_update: researchUpdateDocumentHandler,
};

export * from './text/client';
export * from './research_update/client';
export * from './text/server';
export * from './research_update/server';
