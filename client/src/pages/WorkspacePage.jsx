import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { ChevronLeft, ChevronDown, ChevronRight, FolderOpen, Folder, FileCode, Download, X, AlertCircle } from 'lucide-react';
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

  // Open a file
  async function openFile(path, name) {
    // Already open: just activate
    const existing = tabs.find((t) => t.path === path);
    if (existing) { setActiveTab(path); return; }

    try {
      const res = await api.get(`/workspaces/${id}/file`, { params: { path } });
      const content = res.data.content;
      setTabs((prev) => [...prev, { path, name, content, original: content, dirty: false }]);
      setActiveTab(path);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to open file.');
    }
  }

  function closeTab(path, e) {
    e.stopPropagation();
    const idx = tabs.findIndex((t) => t.path === path);
    const newTabs = tabs.filter((t) => t.path !== path);
    setTabs(newTabs);
    if (activeTab === path) {
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

  const activeContent = tabs.find((t) => t.path === activeTab)?.content ?? '';
  const activeFilename = tabs.find((t) => t.path === activeTab)?.name ?? '';

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

        {/* Right placeholder (Phase 11 assistant) */}
        <div className="w-64 shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
          {/* Task panel */}
          {panelOpen && (
            <div className="border-b border-gray-200 p-3 space-y-2 overflow-y-auto max-h-64">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-6">{task.description}</p>
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
          {/* Assistant placeholder */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
            <AlertCircle size={24} className="text-gray-200" />
            <p className="text-xs text-gray-400 text-center">AI Assistant<br /><span className="text-gray-300">(Phase 11)</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
