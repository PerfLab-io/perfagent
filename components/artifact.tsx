import { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import { UseChatHelpers } from '@ai-sdk/react';
import { type DataStreamDelta } from './data-stream-handler';
import { JSONValue } from '@ai-sdk/ui-utils';

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

export type ArtifactToolbarContext = {
	appendMessage: UseChatHelpers['append'];
};

export type ArtifactToolbarItem = {
	description: string;
	icon: ReactNode;
	onClick: (context: ArtifactToolbarContext) => void;
};

interface ArtifactContent<M = any> {
	title: string;
	content: string;
	documentId: string;
	mode: 'edit' | 'diff';
	isCurrentVersion: boolean;
	currentVersionIndex: number;
	status: 'streaming' | 'idle';
	onSaveContent: (updatedContent: string, debounce: boolean) => void;
	isInline: boolean;
	getDocumentContentById: (index: number) => string;
	isLoading: boolean;
	metadata: M;
	setMetadata: Dispatch<SetStateAction<M>>;
}

export type ArtifactActionContext<M = any> = {
	content: string;
	handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
	currentVersionIndex: number;
	isCurrentVersion: boolean;
	mode: 'edit' | 'diff';
	metadata: M;
	setMetadata: Dispatch<SetStateAction<M>>;
};

type ArtifactAction<M = any> = {
	icon: ReactNode;
	label?: string;
	description: string;
	onClick: (context: ArtifactActionContext<M>) => Promise<void> | void;
	isDisabled?: (context: ArtifactActionContext<M>) => boolean;
};

interface InitializeParameters<M = any> {
	documentId: string;
	setMetadata: Dispatch<SetStateAction<M>>;
}

export type OnStreamPartParameters<
	T extends NonNullable<JSONValue>,
	Metadata = any,
> = {
	setMetadata: Dispatch<SetStateAction<Metadata>>;
	setArtifact: Dispatch<SetStateAction<UIArtifact>>;
	streamPart: DataStreamDelta<T>;
};

type ArtifactConfig<
	T extends string,
	M = any,
	OnStreamPartContent extends NonNullable<JSONValue> = NonNullable<JSONValue>,
> = {
	kind: T;
	description: string;
	content: ComponentType<ArtifactContent<M>>;
	actions: Array<ArtifactAction<M>>;
	toolbar: ArtifactToolbarItem[];
	initialize?: (parameters: InitializeParameters<M>) => Promise<void>;
	onStreamPart: (
		params: OnStreamPartParameters<OnStreamPartContent, M>,
	) => void;
};

export class Artifact<
	Kind extends string,
	Metadata = unknown,
	OnStreamPartContent extends NonNullable<JSONValue> = NonNullable<JSONValue>,
> {
	kind: Kind;
	description: string;
	initialize?: (params: InitializeParameters<Metadata>) => Promise<void>;
	onStreamPart?: (
		params: OnStreamPartParameters<OnStreamPartContent, Metadata>,
	) => void;
	content: ComponentType<ArtifactContent<Metadata>>;
	actions: Array<ArtifactAction<Metadata>>;

	constructor(params: ArtifactConfig<Kind, Metadata, OnStreamPartContent>) {
		this.kind = params.kind;
		this.description = params.description;
		this.initialize = params.initialize;
		this.onStreamPart = params.onStreamPart;
		this.content = params.content;
		this.actions = params.actions;
	}
}
