import { DataStreamWriter } from 'ai';

export type DocumentHandler<Kind extends string> = {
	kind: Kind;
	onCreateDocument: (params: {
		title: string;
		dataStream: DataStreamWriter;
	}) => Promise<string>;
	onUpdateDocument: (params: {
		document: {
			id: string;
			content: string | null;
		};
		description: string;
		dataStream: DataStreamWriter;
	}) => Promise<string>;
};

export function createDocumentHandler<Kind extends string>(
	handler: DocumentHandler<Kind>,
): DocumentHandler<Kind> {
	return handler;
}
