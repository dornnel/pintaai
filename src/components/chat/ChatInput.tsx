import { useRef, useState, useEffect, type KeyboardEvent, type ChangeEvent } from 'react'
import { Send, Paperclip, X, Image } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  onSend: (text: string, files?: File[]) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = 'Digite uma mensagem...' }: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-focus when agent finishes responding (disabled: true → false)
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed && files.length === 0) return
    onSend(trimmed, files.length > 0 ? files : undefined)
    setText('')
    setFiles([])
    inputRef.current?.focus()
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...picked].slice(0, 5))
    e.target.value = ''
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
    setFiles((prev) => [...prev, ...dropped].slice(0, 5))
  }

  return (
    <div
      className={cn('border rounded-2xl bg-white transition-colors', dragging && 'border-brand bg-orange-50')}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {files.length > 0 && (
        <div className="flex gap-2 p-3 pb-0 flex-wrap">
          {files.map((f, i) => (
            <div key={i} className="relative group">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {f.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <button
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors shrink-0"
          title="Enviar foto ou vídeo"
        >
          <Paperclip className="w-4.5 h-4.5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus
          rows={1}
          className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 bg-transparent py-2 max-h-32 leading-relaxed"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />

        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && files.length === 0)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
