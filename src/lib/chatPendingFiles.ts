// In-memory store for files selected in the landing hero chat before navigating to /chat.
// Since this is a SPA, module-level state persists across route changes.
let _files: File[] = []
export const pendingChatFiles = {
  set: (files: File[]) => { _files = files },
  take: (): File[] => { const f = _files; _files = []; return f },
  has: (): boolean => _files.length > 0,
}
