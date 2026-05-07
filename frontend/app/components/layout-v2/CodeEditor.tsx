'use client';

import { forwardRef, useEffect, useMemo, useState, type ChangeEvent, type TextareaHTMLAttributes } from 'react';
import styles from './CodeEditor.module.css';

interface CodeEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  language?: string;
  onChange?: TextareaHTMLAttributes<HTMLTextAreaElement>['onChange'];
  onValueChange?: (value: string) => void;
  // Kept for API compatibility with older call sites; plain textarea has no validation markers.
  onValidate?: (markers: unknown[]) => void;
  height?: string | number;
}

const CodeEditor = forwardRef<HTMLTextAreaElement, CodeEditorProps>(function CodeEditor(
  {
    label = 'Code',
    language = 'json',
    onChange,
    onValueChange,
    onValidate: _onValidate,
    height,
    value,
    defaultValue,
    rows = 8,
    style,
    ...props
  },
  ref,
) {
  const initialValue = useMemo(() => String(value ?? defaultValue ?? ''), [defaultValue, value]);
  const [editorValue, setEditorValue] = useState(initialValue);
  const editorHeight = height ?? Math.max(180, Number(rows) * 28);
  const editorHeightValue = typeof editorHeight === 'number' ? `${editorHeight}px` : editorHeight;
  void _onValidate;

  useEffect(() => {
    if (value == null) return;
    setEditorValue(String(value));
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;
    setEditorValue(nextValue);
    onValueChange?.(nextValue);
    onChange?.(event);
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.header}>
        <strong>{label}</strong>
        <span>Text · {language}</span>
      </span>
      <textarea
        {...props}
        ref={ref}
        className={[styles.editorTextarea, props.className].filter(Boolean).join(' ')}
        value={editorValue}
        onChange={handleChange}
        rows={rows}
        style={{ ...style, height: editorHeightValue }}
        spellCheck={false}
      />
    </div>
  );
});

export default CodeEditor;
