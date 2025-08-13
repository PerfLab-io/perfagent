'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Plus } from 'lucide-react';
import { addMcpServerAction } from '@/app/actions/mcp-servers';
import { toast } from 'sonner';
import { useMCPServersStore } from '@/lib/stores/mcp-servers-store';
import { useTestServerConnection } from '@/lib/hooks/use-mcp-server-test';

function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? 'Adding...' : 'Add Server'}
		</Button>
	);
}

export function AddServerDialog() {
	const [open, setOpen] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const formRef = useRef<HTMLFormElement>(null);

	const addServer = useMCPServersStore((s) => s.addServer);
	const testServerConnection = useTestServerConnection();

	const handleCancel = () => {
		setOpen(false);
		setFormError(null);
	};

	const formAction = async (formData: FormData) => {
		try {
			const result = await addMcpServerAction(formData);

			if (result.success) {
				addServer(result.data);
				setOpen(false);
				formRef.current?.reset();
				setFormError(null);
				toast.success('MCP server added successfully');

				testServerConnection(result.data.id);
			} else {
				setFormError(result.error || 'Failed to add MCP server');
				toast.error(result.error || 'Failed to add MCP server');
			}
		} catch (error) {
			const errorMessage = 'Failed to add MCP server';
			setFormError(errorMessage);
			toast.error(errorMessage);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(newOpen) => {
				setOpen(newOpen);
				if (newOpen) setFormError(null);
			}}
		>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Add Server
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add MCP Server</DialogTitle>
					<DialogDescription>
						Connect to a new Model Context Protocol server
					</DialogDescription>
				</DialogHeader>
				{/* TODO: Future migration to TanStack Form for enhanced validation and type safety */}
				<form ref={formRef} action={formAction} className="space-y-4">
					{formError && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{formError}</AlertDescription>
						</Alert>
					)}
					<div>
						<Label htmlFor="name">Server Name</Label>
						<Input id="name" name="name" required placeholder="My MCP Server" />
					</div>
					<div>
						<Label htmlFor="url">Server URL</Label>
						<Input
							id="url"
							name="url"
							type="url"
							required
							placeholder="https://example.com/api/mcp"
						/>
					</div>
					<p className="text-muted-foreground text-sm">
						OAuth authentication will be automatically detected and configured
						if required by the server.
					</p>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<SubmitButton />
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
