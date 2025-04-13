import React from 'react';
import type { UIMessage } from 'ai';

// Define a type for the artifact kinds (will be populated later)
export type ArtifactKind = string;

export interface UIArtifact {
	title: string;
	documentId: string;
	kind: ArtifactKind;
	content: string;
	isVisible: boolean;
	timestamp: number;
	status: 'streaming' | 'idle';
	boundingBox: {
		top: number;
		left: number;
		width: number;
		height: number;
	};
}

export class Artifact<Kind extends string, Metadata = unknown> {
	kind: Kind;
	description: string;
	initialize?: (params: {
		documentId: string;
		setMetadata: (
			metadata: Metadata | ((metadata: Metadata) => Metadata),
		) => void;
	}) => Promise<void>;
	onStreamPart?: (params: {
		streamPart: any;
		setMetadata: (
			metadata: Metadata | ((metadata: Metadata) => Metadata),
		) => void;
		setArtifact: (
			artifact: UIArtifact | ((artifact: UIArtifact) => UIArtifact),
		) => void;
	}) => void;
	content: (params: {
		content: string;
		metadata?: Metadata;
		mode?: 'edit' | 'diff';
		status: 'streaming' | 'idle';
		isCurrentVersion?: boolean;
		currentVersionIndex?: number;
		onSaveContent?: (content: string, debounce: boolean) => void;
		getDocumentContentById?: (index: number) => string;
		isLoading?: boolean;
	}) => React.ReactElement | null;
	actions: Array<{
		icon: React.ReactElement;
		description: string;
		onClick: (params: {
			content: string;
			metadata?: Metadata;
			handleVersionChange?: (
				type: 'next' | 'prev' | 'toggle' | 'latest',
			) => void;
			appendMessage?: (message: UIMessage) => void;
		}) => void;
		isDisabled?: (params: {
			content: string;
			metadata?: Metadata;
			isCurrentVersion?: boolean;
			currentVersionIndex?: number;
			setMetadata?: (
				metadata: Metadata | ((metadata: Metadata) => Metadata),
			) => void;
		}) => boolean;
	}>;

	constructor(params: {
		kind: Kind;
		description: string;
		initialize?: (params: {
			documentId: string;
			setMetadata: (
				metadata: Metadata | ((metadata: Metadata) => Metadata),
			) => void;
		}) => Promise<void>;
		onStreamPart?: (params: {
			streamPart: any;
			setMetadata: (
				metadata: Metadata | ((metadata: Metadata) => Metadata),
			) => void;
			setArtifact: (
				artifact: UIArtifact | ((artifact: UIArtifact) => UIArtifact),
			) => void;
		}) => void;
		content: (params: {
			content: string;
			metadata?: Metadata;
			mode?: 'edit' | 'diff';
			status: 'streaming' | 'idle';
			isCurrentVersion?: boolean;
			currentVersionIndex?: number;
			onSaveContent?: (content: string, debounce: boolean) => void;
			getDocumentContentById?: (index: number) => string;
			isLoading?: boolean;
		}) => React.ReactElement | null;
		actions: Array<{
			icon: React.ReactElement;
			description: string;
			onClick: (params: {
				content: string;
				metadata?: Metadata;
				handleVersionChange?: (
					type: 'next' | 'prev' | 'toggle' | 'latest',
				) => void;
				appendMessage?: (message: UIMessage) => void;
			}) => void;
			isDisabled?: (params: {
				content: string;
				metadata?: Metadata;
				isCurrentVersion?: boolean;
				currentVersionIndex?: number;
				setMetadata?: (
					metadata: Metadata | ((metadata: Metadata) => Metadata),
				) => void;
			}) => boolean;
		}>;
	}) {
		this.kind = params.kind;
		this.description = params.description;
		this.initialize = params.initialize;
		this.onStreamPart = params.onStreamPart;
		this.content = params.content;
		this.actions = params.actions;
	}
}
