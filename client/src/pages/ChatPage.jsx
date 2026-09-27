import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const ROLE_BADGE = {
  ADMIN: 'bg-slate-100 text-slate-700',
  HR: 'bg-purple-100 text-purple-700',
  MENTOR: 'bg-blue-100 text-blue-700',
  MENTEE: 'bg-green-100 text-green-700',
};

function roleLabel(role) {
  if (!role) return '';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mergeMessages(prev, incoming) {
  const map = new Map(incoming.map((m) => [m.id, m]));
  for (const m of prev) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  return [...map.values()].sort((a, b) => {
    const diff = new Date(a.createdAt) - new Date(b.createdAt);
    return diff !== 0 ? diff : a.id - b.id;
  });
}

export default function ChatPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const withId = searchParams.get('with');

  const [contacts, setContacts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);
  const lastMessageId = useRef(null);
  const openedWith = useRef(null);
  const contactsOk = useRef(false);
  const openGen = useRef(0);

  const refreshContacts = useCallback(async () => {
    const res = await api.get('/chat/contacts');
    setContacts(res.data.contacts ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await api.get('/chat/contacts');
        if (!cancelled) {
          setContacts(res.data.contacts ?? []);
          contactsOk.current = true;
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const openContact = useCallback(async (contact) => {
    const gen = ++openGen.current;
    setActive(contact);
    setMessages([]);
    setConversationId(null);
    try {
      const res = await api.post('/chat/conversations', { userId: contact.id });
      if (gen !== openGen.current) return;
      setConversationId(res.data.conversation.id);
      setActive(res.data.conversation.otherUser ?? contact);
    } catch (err) {
      if (gen !== openGen.current) return;
      toast.error(err.response?.data?.error ?? 'Could not open conversation.');
    }
  }, []);

  useEffect(() => {
    if (!loaded || !contactsOk.current) return;
    const id = parseInt(withId, 10);
    if (!Number.isInteger(id) || openedWith.current === id) return;
    openedWith.current = id;
    const contact = contacts.find((c) => c.id === id);
    if (!contact) {
      toast.error('You cannot message this user.');
      return;
    }
    openContact(contact);
  }, [loaded, withId, contacts, openContact]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;

    async function tick() {
      try {
        const res = await api.get(`/chat/conversations/${conversationId}/messages`);
        if (cancelled) return;
        setMessages((prev) => mergeMessages(prev, res.data.messages ?? []));
        setContacts((prev) => prev.map((c) => (
          c.id === active?.id ? { ...c, unreadCount: 0 } : c
        )));
      } catch {
        /* poll errors stay quiet */
      }
    }

    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [conversationId, active?.id]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id === lastMessageId.current) return;
    lastMessageId.current = last.id;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/chat/conversations/${conversationId}/messages`, { body: text });
      setMessages((prev) => mergeMessages(prev, [res.data.message]));
      setInput('');
      refreshContacts().catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-white border border-gray-200 rounded-xl overflow-hidden">
      <aside className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 shrink-0 border-r border-gray-200`}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-900">Chat</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!loaded && (
            <p className="px-4 py-6 text-sm text-gray-400">Loading contacts…</p>
          )}
          {loaded && contacts.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500">No contacts available.</p>
          )}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => openContact(contact)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-gray-50 hover:bg-gray-50 ${
                active?.id === contact.id ? 'bg-gray-100' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gray-800 text-white flex items-center justify-center text-sm font-bold shrink-0">
                {contact.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                  {contact.unreadCount > 0 && (
                    <span className="ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
                      {contact.unreadCount}
                    </span>
                  )}
                </div>
                <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_BADGE[contact.role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {roleLabel(contact.role)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={`${active ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
        {!active && (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select a contact to start chatting.
          </div>
        )}
        {active && (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <button
                type="button"
                className="md:hidden text-gray-500 hover:text-gray-800"
                onClick={() => {
                  setActive(null);
                  setConversationId(null);
                  setMessages([]);
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <p className="text-sm font-semibold text-gray-900">{active.name}</p>
                <p className="text-xs text-gray-500">{roleLabel(active.role)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {conversationId && messages.length === 0 && (
                <p className="text-center text-sm text-gray-400">No messages yet.</p>
              )}
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="border-t border-gray-100 p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                placeholder={conversationId ? 'Write a message…' : 'Opening conversation…'}
                disabled={!conversationId || sending}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={!conversationId || sending || !input.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-slate-800 text-white px-3 py-2 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
