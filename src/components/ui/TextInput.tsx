import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { inputClass } from './inputStyles';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid = false, className, ...props }: TextInputProps) {
  return <input className={inputClass(invalid, className)} aria-invalid={invalid || undefined} {...props} />;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea rows={rows} className={inputClass(invalid, className)} aria-invalid={invalid || undefined} {...props} />
  );
}
