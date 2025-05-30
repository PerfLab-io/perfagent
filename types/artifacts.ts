import { JSONValue } from 'ai';

export interface Artifact {
	id: string;
	type: string;
	content: string;
}

export type ArtifactType = 'text' | 'research_update';

export interface TextArtifact extends Artifact {
	type: 'text';
}

export interface ResearchUpdateArtifact extends Artifact {
	type: 'research_update';
	data: JSONValue;
}

export interface StreamData {
	type: string;
	data: JSONValue;
}

export type ArtifactStreamDelta = {
	type: string;
	content: string | JSONValue;
};
