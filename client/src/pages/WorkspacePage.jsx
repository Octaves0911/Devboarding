import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  ChevronLeft, ChevronDown, ChevronRight, FolderOpen, Folder, FileCode,
  Download, X, Send, Loader2, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';

// ── Monaco loader: use local package, not CDN ────────────────────────────────
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
loader.config({ monaco });

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    json: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss',
    md: 'markdown', py: 'python', java: 'java', c: 'c', cpp: 'cpp',
    cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
    sh: 'shell', yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql',
    txt: 'plaintext',
  };
  return map[ext] ?? 'plaintext';
}

// ── File Tree Node ────────────────────────────────────────────────────────────

function TreeNode({ node, selectedPath, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 12;

  if (node.type === 'dir') {
    return (
      <div>
        <button
          className="flex items-center gap-1.5 w-full text-left px-2 py-0.5 hover:bg-gray-100 rounded text-xs text-gray-700"
          style={{ paddingLeft: `${8 + indent}px` }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown size={11} className="shrink-0 text-gray-400" /> : <ChevronRight size={11} className="shrink-0 text-gray-400" />}
          {open ? <FolderOpen size={13} className="text-yellow-500 shrink-0" /> : <Folder size={13} className="text-yellow-400 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <button
      className={`flex items-center gap-1.5 w-full text-left px-2 py-0.5 rounded text-xs truncate ${
        selectedPath === node.path ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
      }`}
      style={{ paddingLeft: `${20 + indent}px` }}
      onClick={() => onSelect(node.path, node.name)}
    >
      <FileCode size={12} className="shrink-0 text-gray-400" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkspacePage({ readOnly = false }) {
  const { taskId } = useParams();
  const navigate   = useNavigate();
  const id         = parseInt(taskId, 10);

  const [task,    setTask]    = useState(null);
  const [tree,    setTree]    = useState([]);
  const [loading, setLoading] = useState(true);

  // Tabs: [{ path, name, content, original, dirty }]
  const [tabs,        setTabs]        = useState([]);
  const [activeTab,   setActiveTab]   = useState(null); // path string
  const [saving,      setSaving]      = useState(false);

  // Task panel
  const [panelOpen, setPanelOpen] = useState(true);

  // ── Review state ─────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [lastReview,   setLastReview]   = useState(null); // { verdict, summary, issues, createdAt }

  // ── Assistant state ──────────────────────────────────────────────────────
  const [chatMessages,  setChatMessages]  = useState([]); // [{ role, content }]
  const [chatInput,     setChatInput]     = useState('');
  const [chatLoading,   setChatLoading]   = useState(false);
  const chatEndRef = useRef(null);

  // Monaco editor ref for line navigation
  const editorRef = useRef(null);

  // Load task + tree
  const loadTree = useCallback(async () => {
    try {
      const [taskRes, treeRes] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get(`/workspaces/${id}/tree`),
      ]);
      setTask(taskRes.data.task);
      setTree(treeRes.data.tree);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to load workspace.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTree(); }, [loadTree]);

  // Load latest review on mount
  useEffect(() => {
    if (!id) return;
    api.get(`/workspaces/${id}/reviews`)
      .then((res) => {
        const reviews = res.data.reviews;
        if (reviews?.length > 0) setLastReview(reviews[0]);
      })
      .catch(() => {/* ignore */});
  }, [id]);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Open a file
  async function openFile(filePath, name) {
    // Already open: just activate
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) { setActiveTab(filePath); return; }

    try {
      const res = await api.get(`/workspaces/${id}/file`, { params: { path: filePath } });
      const content = res.data.content;
      setTabs((prev) => [...prev, { path: filePath, name, content, original: content, dirty: false }]);
      setActiveTab(filePath);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to open file.');
    }
  }

  // Open file at a specific line (for issue navigation)
  async function openFileAtLine(filePath, line) {
    const name = filePath.split('/').pop();
    await openFile(filePath, name);
    if (line && editorRef.current) {
      setTimeout(() => {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus();
      }, 150);
    }
  }

  function closeTab(filePath, e) {
    e.stopPropagation();
    const idx = tabs.findIndex((t) => t.path === filePath);
    const newTabs = tabs.filter((t) => t.path !== filePath);
    setTabs(newTabs);
    if (activeTab === filePath) {
      setActiveTab(newTabs[Math.max(0, idx - 1)]?.path ?? null);
    }
  }

  function onEditorChange(value) {
    if (readOnly) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTab ? { ...t, content: value ?? '', dirty: value !== t.original } : t
      )
    );
  }

  async function saveCurrentFile() {
    if (readOnly) return;
    const tab = tabs.find((t) => t.path === activeTab);
    if (!tab || !tab.dirty) return;

    setSaving(true);
    try {
      await api.put(`/workspaces/${id}/file`, { content: tab.content }, { params: { path: tab.path } });
      setTabs((prev) =>
        prev.map((t) => (t.path === activeTab ? { ...t, original: t.content, dirty: false } : t))
      );
      // Refresh task status (TODO → IN_PROGRESS on first save)
      const res = await api.get(`/tasks/${id}`);
      setTask(res.data.task);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to save file.');
    } finally {
      setSaving(false);
    }
  }

  // Ctrl/Cmd+S
  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
  }

  function handleDownload() {
    window.open(`/api/workspaces/${id}/download`, '_blank');
  }

  // ── Submit for review ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/workspaces/${id}/submit`);
      const review = res.data.review;
      setLastReview(review);
      // Refresh task (status may have changed)
      const taskRes = await api.get(`/tasks/${id}`);
      setTask(taskRes.data.task);
      if (review.verdict === 'PASS') {
        toast.success('Review passed! Task marked as done.');
      } else {
        toast.error(`Review failed — ${review.issues?.length ?? 0} issue(s) found.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to submit for review.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Assistant chat ───────────────────────────────────────────────────────
  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const newMessages = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await api.post(`/workspaces/${id}/assistant`, {
        messages: newMessages,
        openFilePath: activeTab ?? undefined,
      });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Assistant unavailable.');
      setChatMessages((prev) => prev.slice(0, -1)); // remove optimistic user msg
      setChatInput(text);
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  }

  const activeContent  = tabs.find((t) => t.path === activeTab)?.content ?? '';
  const activeFilename = tabs.find((t) => t.path === activeTab)?.name ?? '';

  const canSubmit = !readOnly && task?.status === 'IN_PROGRESS' && !submitting;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (!task) {
    return <div className="text-center py-16 text-red-600 text-sm">Workspace not found.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 shrink-0"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <span className="font-semibold text-gray-800 text-sm truncate">{task.title}</span>
          <StatusBadge type="status" value={task.status} />
          {readOnly && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium shrink-0">Read-only</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!readOnly && (
            <Button size="sm" variant="secondary" onClick={saveCurrentFile} loading={saving} disabled={!tabs.find((t) => t.path === activeTab && t.dirty)}>
              Save
            </Button>
          )}
          {!readOnly && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              title={task.status !== 'IN_PROGRESS' ? 'Task must be IN_PROGRESS to submit' : ''}
            >
              {submitting ? 'Reviewing…' : 'Submit for review'}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleDownload}>
            <Download size={13} /> Download zip
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPanelOpen((o) => !o)}
            className="text-xs"
          >
            {panelOpen ? 'Hide task' : 'Show task'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <div className="w-52 shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto py-2">
          {tree.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-4 text-center">No files</p>
          ) : (
            tree.map((node) => (
              <TreeNode key={node.path} node={node} selectedPath={activeTab} onSelect={openFile} />
            ))
          )}
        </div>

        {/* Editor area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs row */}
          <div className="flex items-center border-b border-gray-200 bg-white overflow-x-auto shrink-0">
            {tabs.map((tab) => (
              <div
                key={tab.path}
                onClick={() => setActiveTab(tab.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-200 whitespace-nowrap shrink-0 ${
                  activeTab === tab.path
                    ? 'bg-white text-gray-800 border-b-2 border-b-blue-500'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                <span className="max-w-[120px] truncate">{tab.name}</span>
                <button
                  onClick={(e) => closeTab(tab.path, e)}
                  className="text-gray-400 hover:text-red-500 ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {tabs.length === 0 && (
              <span className="text-xs text-gray-400 px-3 py-2">Select a file from the tree</span>
            )}
          </div>

          {/* Monaco */}
          <div className="flex-1 overflow-hidden">
            {activeTab ? (
              <Editor
                height="100%"
                language={getLanguage(activeFilename)}
                value={activeContent}
                onChange={onEditorChange}
                onMount={(editor) => { editorRef.current = editor; }}
                options={{
                  readOnly,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
                theme="light"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <FolderOpen size={36} className="text-gray-200" />
                <p className="text-sm">Open a file from the tree</p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — task info + review + assistant */}
        <div className="w-72 shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
          {/* Task panel */}
          {panelOpen && (
            <div className="border-b border-gray-200 p-3 space-y-2 overflow-y-auto max-h-56 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-5">{task.description}</p>
              {task.subtasks?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Subtasks ({task.subtasks.filter((s) => s.isDone).length}/{task.subtasks.length})
                  </p>
                  <ul className="space-y-1">
                    {task.subtasks.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded border shrink-0 flex items-center justify-center ${s.isDone ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                          {s.isDone && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                        <span className={s.isDone ? 'line-through text-gray-400' : 'text-gray-700'}>{s.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Last review result */}
          {lastReview && (
            <div className={`border-b p-3 shrink-0 ${lastReview.verdict === 'PASS' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                {lastReview.verdict === 'PASS'
                  ? <CheckCircle size={13} className="text-green-600 shrink-0" />
                  : <XCircle size={13} className="text-red-600 shrink-0" />}
                <span className={`text-xs font-semibold ${lastReview.verdict === 'PASS' ? 'text-green-700' : 'text-red-700'}`}>
                  Review {lastReview.verdict}
                </span>
              </div>
              <p className="text-xs text-gray-700 mb-2 line-clamp-3">{lastReview.summary}</p>
              {lastReview.issues?.length > 0 && (
                <ul className="space-y-1">
                  {lastReview.issues.map((issue, i) => (
                    <li key={i}>
                      <button
                        className="w-full text-left text-xs px-2 py-1 rounded bg-white border border-red-200 hover:border-red-400 flex items-start gap-1.5"
                        onClick={() => openFileAtLine(issue.file, issue.line)}
                        title={`${issue.file}${issue.line ? `:${issue.line}` : ''}`}
                      >
                        <AlertTriangle size={10} className={`shrink-0 mt-0.5 ${issue.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}`} />
                        <span className="text-gray-700 line-clamp-2">{issue.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Assistant chat */}
          {!readOnly ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200 shrink-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Assistant</p>
                <p className="text-xs text-gray-400">Hints &amp; explanations only</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-gray-400 text-center pt-4">Ask a question about your code or an error you're seeing.</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                      <Loader2 size={12} className="animate-spin text-gray-400" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-gray-200 p-2 flex gap-1.5 items-end">
                <textarea
                  rows={2}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Ask a question… (Enter to send)"
                  className="flex-1 resize-none text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="shrink-0 p-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-gray-400 text-center">Assistant not available in read-only mode.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
