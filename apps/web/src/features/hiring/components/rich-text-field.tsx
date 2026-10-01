'use client'

import { Input } from '@mantine/core'
import { Link, RichTextEditor } from '@mantine/tiptap'
import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useId, type ReactNode } from 'react'

// Tiptap keeps an empty paragraph after a trailing list so the caret can leave it; that is not content.
function valueOf(editor: Editor) {
  return editor.isEmpty ? '' : editor.getHTML().replace(/(<p><\/p>)+$/, '')
}

export interface RichTextFieldProps {
  label: string
  description?: ReactNode
  required?: boolean
  error?: string
  /** HTML, or '' when the editor holds nothing. */
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
}

export function RichTextField({
  label,
  description,
  required,
  error,
  value,
  onChange,
  onBlur,
}: RichTextFieldProps) {
  const id = useId()
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`

  const editor = useEditor({
    // Next renders this on the server first, where ProseMirror has no DOM to mount into.
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({ link: false, heading: { levels: [2, 3, 4] } }), Link],
    content: value,
    onUpdate: ({ editor: current }) => onChange(valueOf(current)),
    onBlur: () => onBlur?.(),
  })

  // ProseMirror owns the editable node, so its ARIA has to be pushed in rather than rendered.
  useEffect(() => {
    if (!editor) return
    const describedBy = [description ? descriptionId : '', error ? errorId : '']
      .filter(Boolean)
      .join(' ')
    editor.setOptions({
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-labelledby': labelId,
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
          ...(required ? { 'aria-required': 'true' } : {}),
          ...(error ? { 'aria-invalid': 'true' } : {}),
          style: 'min-height: calc(12rem * var(--mantine-scale))',
        },
      },
    })
  }, [editor, description, descriptionId, error, errorId, labelId, required])

  // A form reset() replaces the value from outside; typing never trips this because it already matches.
  useEffect(() => {
    if (!editor) return
    if (valueOf(editor) !== value) editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  return (
    <Input.Wrapper
      label={label}
      description={description}
      error={error}
      required={required}
      labelProps={{ id: labelId, onClick: () => editor?.commands.focus() }}
      descriptionProps={{ id: descriptionId }}
      errorProps={{ id: errorId, role: 'alert' }}
    >
      <RichTextEditor editor={editor} mt={4}>
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
            <RichTextEditor.H4 />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.Blockquote />
            <RichTextEditor.Hr />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content />
      </RichTextEditor>
    </Input.Wrapper>
  )
}
