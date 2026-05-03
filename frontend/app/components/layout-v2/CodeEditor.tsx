'use client';

import Editor, { type OnMount } from '@monaco-editor/react';
import { forwardRef, useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react';
import styles from './CodeEditor.module.css';

interface CodeEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  language?: string;
  onChange?: TextareaHTMLAttributes<HTMLTextAreaElement>['onChange'];
  onValueChange?: (value: string) => void;
  onValidate?: (markers: unknown[]) => void;
  height?: string | number;
}

const CodeEditor = forwardRef<HTMLTextAreaElement, CodeEditorProps>(function CodeEditor(
  {
    label = 'Code',
    language = 'json',
    onChange,
    onValueChange,
    onValidate,
    height,
    value,
    defaultValue,
    rows = 8,
    ...props
  },
  ref,
) {
  const initialValue = useMemo(() => String(value ?? defaultValue ?? ''), [defaultValue, value]);
  const [editorValue, setEditorValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorHeight = height ?? Math.max(180, Number(rows) * 28);

  useEffect(() => {
    if (value == null) return;
    setEditorValue(String(value));
  }, [value]);

  function assignRef(node: HTMLTextAreaElement | null) {
    textareaRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }

  function emitChange(nextValue: string) {
    setEditorValue(nextValue);
    if (textareaRef.current) textareaRef.current.value = nextValue;
    onValueChange?.(nextValue);
    if (onChange && textareaRef.current) {
      onChange({
        target: textareaRef.current,
        currentTarget: textareaRef.current,
      } as Parameters<NonNullable<typeof onChange>>[0]);
    }
  }

  const handleMount: OnMount = (editor, monaco) => {
    monaco.editor.setTheme('vs-dark');
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        schemas: [],
      });
    }
    editor.layout();
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.header}>
        <strong>{label}</strong>
        <span>Monaco · {language}</span>
      </span>
      <Editor
        height={editorHeight}
        theme="vs-dark"
        language={language}
        value={editorValue}
        onChange={(nextValue) => emitChange(nextValue ?? '')}
        onMount={handleMount}
        onValidate={onValidate}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          renderLineHighlight: 'all',
        }}
      />
      <textarea
        {...props}
        ref={assignRef}
        className={styles.hiddenTextarea}
        value={editorValue}
        onChange={(event) => emitChange(event.target.value)}
        aria-hidden="true"
        tabIndex={-1}
        spellCheck={false}
      />
    </div>
  );
});

export default CodeEditor;
