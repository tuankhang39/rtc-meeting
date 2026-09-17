import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ChatMessage } from '../hooks/useRoom'
import {
  CHAT_TABS,
  mergeChatResources,
  type ChatLesson,
  type ChatMaterial,
  type ChatNote,
  type ChatTabId,
  type PinnedMessage,
} from '../lib/chatExtras'
import { extractUrls, safeHref, splitTextWithLinks } from '../lib/chatLinks'
import { IconSend } from './Icons'

type Props = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  userId: string
  isHost: boolean
  /** Host đã đăng nhập admin — mới được ghim / ghi chú / học liệu */
  canManageExtras: boolean
  messages: ChatMessage[]
  pinnedMessages: PinnedMessage[]
  notes: ChatNote[]
  lessons: ChatLesson[]
  materials: ChatMaterial[]
  onSendChat: (text: string) => void | Promise<void>
  onPin: (message: ChatMessage) => void | Promise<void>
  onUnpin: (pinId: string) => void | Promise<void>
  onAddNote: (tag: string, text: string) => void | Promise<void>
  onRemoveNote: (id: string) => void | Promise<void>
  onAddLesson: (title: string, link: string) => void | Promise<void>
  onRemoveLesson: (id: string) => void | Promise<void>
  onAddMaterial: (label: string, link: string) => void | Promise<void>
  onRemoveMaterial: (id: string) => void | Promise<void>
}

function LinkedText({ text }: { text: string }) {
  const parts = splitTextWithLinks(text)
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'link' ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="chat-link">
            {p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="muted chat-empty">{children}</p>
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="chat-field">
      <span className="chat-field-label">
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  )
}

export function ChatPanel({
  open,
  onToggle,
  onClose,
  userId: _userId,
  isHost: _isHost,
  canManageExtras,
  messages,
  pinnedMessages,
  notes,
  lessons,
  materials,
  onSendChat,
  onPin,
  onUnpin,
  onAddNote,
  onRemoveNote,
  onAddLesson,
  onRemoveLesson,
  onRemoveMaterial,
}: Props) {
  const [tab, setTab] = useState<ChatTabId>('chat')
  const [chatText, setChatText] = useState('')
  const [noteTag, setNoteTag] = useState('')
  const [noteText, setNoteText] = useState('')
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceLink, setResourceLink] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const resources = useMemo(() => mergeChatResources(lessons, materials), [lessons, materials])

  useEffect(() => {
    if (tab !== 'chat') return
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, tab])

  const pinnedIds = new Set(pinnedMessages.map((p) => p.messageId))

  const submitChat = (e: FormEvent) => {
    e.preventDefault()
    const t = chatText.trim()
    if (!t) return
    void onSendChat(t)
    setChatText('')
  }

  const submitNote = (e: FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    void onAddNote(noteTag, noteText)
    setNoteText('')
  }

  const submitResource = (e: FormEvent) => {
    e.preventDefault()
    if (!resourceTitle.trim()) return
    if (resourceLink.trim() && !safeHref(resourceLink.trim())) return
    void onAddLesson(resourceTitle, resourceLink)
    setResourceTitle('')
    setResourceLink('')
  }

  return (
    <aside className={`chat${open ? '' : ' collapsed'}`}>
      <h2>
        {open && <span>Chat</span>}
        <span className="chat-controls">
          <button
            type="button"
            className="chat-toggle"
            onClick={onToggle}
            title={open ? 'Thu gọn chat' : 'Mở chat'}
            aria-label={open ? 'Thu gọn chat' : 'Mở chat'}
          >
            −
          </button>
          {open && (
            <button type="button" className="chat-close" title="Đóng chat" aria-label="Đóng chat" onClick={onClose}>
              ×
            </button>
          )}
        </span>
      </h2>

      {open && (
        <>
          <div className="chat-tabs" role="tablist" aria-label="Mục chat">
            {CHAT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`chat-tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'chat' && (
            <div className="chat-panel">
              <div className="chat-list" ref={listRef}>
                {messages.length === 0 && <Empty>Chưa có tin nhắn</Empty>}
                {messages.map((m) => {
                  const urls = extractUrls(m.text)
                  const pinned = pinnedIds.has(m.id)
                  return (
                    <div key={m.id} className="chat-item">
                      <div className="chat-item-head">
                        <strong>{m.name}</strong>
                        {canManageExtras && (
                          <button
                            type="button"
                            className={`chat-pin-btn${pinned ? ' pinned' : ''}`}
                            title={pinned ? 'Đã ghim' : 'Ghim tin nhắn'}
                            aria-label={pinned ? 'Đã ghim' : 'Ghim tin nhắn'}
                            disabled={pinned}
                            onClick={() => void onPin(m)}
                          >
                            {pinned ? 'Đã ghim' : 'Ghim'}
                          </button>
                        )}
                      </div>
                      <span className="chat-item-text">
                        <LinkedText text={m.text} />
                      </span>
                      {urls.length > 0 && (
                        <div className="chat-item-links">
                          {urls.map((u) => {
                            const href = safeHref(u)
                            if (!href) return null
                            return (
                              <a key={u} href={href} target="_blank" rel="noopener noreferrer" className="chat-open-link">
                                Mở link
                              </a>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <form onSubmit={submitChat} className="chat-composer">
                <div className="chat-composer-box">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Nhắn gì đó… dán link cũng được"
                    maxLength={500}
                  />
                  <button type="submit" className="chat-composer-send" title="Gửi" aria-label="Gửi">
                    <IconSend size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === 'pins' && (
            <div className="chat-panel">
              <div className="chat-list">
                {pinnedMessages.length === 0 && <Empty>Chưa ghim tin nào</Empty>}
                {pinnedMessages.map((p) => (
                  <div key={p.id} className="chat-item chat-pin-item">
                    <div className="chat-item-head">
                      <strong>{p.authorName}</strong>
                      {canManageExtras && (
                        <button type="button" className="chat-pin-btn" onClick={() => void onUnpin(p.id)}>
                          Bỏ ghim
                        </button>
                      )}
                    </div>
                    <span className="chat-item-text">
                      <LinkedText text={p.text} />
                    </span>
                    <em className="chat-meta">Ghim bởi {p.pinnedByName}</em>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'notes' && (
            <div className="chat-panel">
              <div className="chat-list">
                {notes.length === 0 && <Empty>Ghi chú nhanh cho buổi sau</Empty>}
                {notes.map((n) => (
                  <div key={n.id} className="chat-item">
                    <div className="chat-item-head">
                      <span className="chat-tag">{n.tag}</span>
                      {canManageExtras && (
                        <button type="button" className="chat-pin-btn" onClick={() => void onRemoveNote(n.id)}>
                          Xóa
                        </button>
                      )}
                    </div>
                    <span className="chat-item-text">
                      <LinkedText text={n.text} />
                    </span>
                    <em className="chat-meta">{n.name}</em>
                  </div>
                ))}
              </div>
              {canManageExtras ? (
                <form onSubmit={submitNote} className="chat-extra-form">
                  <Field label="Tag" hint="tuỳ chọn">
                    <input
                      value={noteTag}
                      onChange={(e) => setNoteTag(e.target.value)}
                      placeholder="Ôn tập, Bài tập…"
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Nội dung">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Ghi điều cần nhớ cho buổi sau…"
                      maxLength={500}
                      rows={3}
                      required
                    />
                  </Field>
                  <button type="submit" className="chat-extra-submit">
                    Thêm ghi chú
                  </button>
                </form>
              ) : (
                <p className="chat-admin-hint muted">Chỉ admin được thêm ghi chú</p>
              )}
            </div>
          )}

          {tab === 'resources' && (
            <div className="chat-panel">
              <div className="chat-list">
                {resources.length === 0 && <Empty>Bài học & tài liệu — thêm tên + link</Empty>}
                {resources.map((r) => (
                  <div key={`${r.source}-${r.id}`} className="chat-item chat-resource-item">
                    <div className="chat-item-head">
                      <span className="chat-tag">{r.title}</span>
                      {canManageExtras && (
                        <button
                          type="button"
                          className="chat-pin-btn"
                          onClick={() =>
                            void (r.source === 'lesson' ? onRemoveLesson(r.id) : onRemoveMaterial(r.id))
                          }
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                    {r.link ? (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="chat-open-link">
                        Mở link
                      </a>
                    ) : (
                      <em className="chat-meta">Chưa có link</em>
                    )}
                    <em className="chat-meta">{r.name}</em>
                  </div>
                ))}
              </div>
              {canManageExtras ? (
                <form onSubmit={submitResource} className="chat-extra-form">
                  <Field label="Tên" hint="bài học / tài liệu">
                    <input
                      value={resourceTitle}
                      onChange={(e) => setResourceTitle(e.target.value)}
                      placeholder="Slide tuần 3, Unit 5…"
                      maxLength={120}
                      required
                    />
                  </Field>
                  <Field label="Link" hint="tuỳ chọn">
                    <input
                      value={resourceLink}
                      onChange={(e) => setResourceLink(e.target.value)}
                      placeholder="https://…"
                      maxLength={500}
                      inputMode="url"
                    />
                  </Field>
                  <button type="submit" className="chat-extra-submit">
                    Thêm học liệu
                  </button>
                </form>
              ) : (
                <p className="chat-admin-hint muted">Chỉ admin được thêm học liệu</p>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
