import { RefObject } from 'react'

interface EditorProps {
  editorRef: RefObject<HTMLDivElement | null>
  overlayRef: RefObject<HTMLDivElement | null>
}

/**
 * Renders the contenteditable editor pane and the search highlight overlay.
 * All DOM logic is handled imperatively in TaskPaperApp — this component
 * is intentionally a thin wrapper that just mounts the two divs.
 */
export function Editor({ editorRef, overlayRef }: EditorProps) {
  return (
    <div
      id="editor-container"
      className="relative flex-1 overflow-hidden min-w-0"
    >
      <div
        ref={editorRef}
        id="editor"
        className="editor-pane"
        contentEditable
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        data-gramm_editor="false"
        suppressContentEditableWarning
      />
      <div
        ref={overlayRef}
        id="highlight-overlay"
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      />
    </div>
  )
}
