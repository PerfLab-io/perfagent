'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CheckIcon, XIcon, HelpCircleIcon } from 'lucide-react';

interface ElicitationFormProps {
	title: string;
	description: string;
	schema: any; // Flat JSON schema
	onSubmit: (data: any) => void;
	onDecline: () => void;
	onCancel: () => void;
}

export const ElicitationForm = ({
	title,
	description,
	schema,
	onSubmit,
	onDecline,
	onCancel,
}: ElicitationFormProps) => {
	const [formData, setFormData] = useState<Record<string, any>>({});
	const [loading, setLoading] = useState(false);

	const handleSubmit = async () => {
		setLoading(true);
		try {
			await onSubmit(formData);
		} finally {
			setLoading(false);
		}
	};

	const renderField = (fieldName: string, fieldSchema: any) => {
		const fieldType = fieldSchema.type || 'string';
		const value = formData[fieldName] || '';

		const handleChange = (newValue: any) => {
			setFormData((prev) => ({
				...prev,
				[fieldName]: newValue,
			}));
		};

		switch (fieldType) {
			case 'boolean':
				return (
					<div className="flex items-center space-x-2">
						<Switch
							id={fieldName}
							checked={value}
							onCheckedChange={handleChange}
						/>
						<Label htmlFor={fieldName}>{fieldSchema.title || fieldName}</Label>
					</div>
				);

			case 'number':
			case 'integer':
				return (
					<div className="space-y-2">
						<Label htmlFor={fieldName}>
							{fieldSchema.title || fieldName}
							{fieldSchema.required && <span className="text-red-500">*</span>}
						</Label>
						<Input
							id={fieldName}
							type="number"
							value={value}
							onChange={(e) => handleChange(Number(e.target.value))}
							placeholder={fieldSchema.description}
						/>
					</div>
				);

			case 'string':
			default:
				if (fieldSchema.enum) {
					return (
						<div className="space-y-2">
							<Label htmlFor={fieldName}>
								{fieldSchema.title || fieldName}
								{fieldSchema.required && (
									<span className="text-red-500">*</span>
								)}
							</Label>
							<select
								id={fieldName}
								value={value}
								onChange={(e) => handleChange(e.target.value)}
								className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
							>
								<option value="">Select an option</option>
								{fieldSchema.enum.map((option: string) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>
					);
				}

				if (fieldSchema.maxLength && fieldSchema.maxLength > 100) {
					return (
						<div className="space-y-2">
							<Label htmlFor={fieldName}>
								{fieldSchema.title || fieldName}
								{fieldSchema.required && (
									<span className="text-red-500">*</span>
								)}
							</Label>
							<Textarea
								id={fieldName}
								value={value}
								onChange={(e) => handleChange(e.target.value)}
								placeholder={fieldSchema.description}
								rows={3}
							/>
						</div>
					);
				}

				return (
					<div className="space-y-2">
						<Label htmlFor={fieldName}>
							{fieldSchema.title || fieldName}
							{fieldSchema.required && <span className="text-red-500">*</span>}
						</Label>
						<Input
							id={fieldName}
							value={value}
							onChange={(e) => handleChange(e.target.value)}
							placeholder={fieldSchema.description}
						/>
					</div>
				);
		}
	};

	return (
		<Card className="w-full max-w-lg border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
			<CardHeader>
				<div className="flex items-center space-x-2">
					<HelpCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
					<CardTitle className="text-lg">{title}</CardTitle>
				</div>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{schema.properties &&
					Object.entries(schema.properties).map(([fieldName, fieldSchema]) =>
						renderField(fieldName, fieldSchema as any),
					)}

				<div className="flex space-x-2">
					<Button
						onClick={handleSubmit}
						disabled={loading}
						className="flex-1"
						size="sm"
					>
						<CheckIcon className="mr-2 h-4 w-4" />
						Submit
					</Button>
					<Button
						onClick={onDecline}
						variant="outline"
						disabled={loading}
						size="sm"
					>
						<XIcon className="mr-2 h-4 w-4" />
						Decline
					</Button>
					<Button
						onClick={onCancel}
						variant="ghost"
						disabled={loading}
						size="sm"
					>
						Cancel
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
