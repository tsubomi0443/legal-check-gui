import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, FolderOpen, FileText, File, Send, Upload, ChevronRight, ChevronDown,
  CheckCircle, Loader2, AlertCircle, GitMerge, MessageSquare,
  PanelRightClose, PanelRight, PanelBottomClose, PanelBottom, PanelLeftClose, PanelLeft,
  Settings, X, Check, Edit3, FolderPlus, Trash2, Save, Info, Database
} from 'lucide-react';

// ============================================================================
// Wails (Go) Backend API Interface
// ============================================================================
declare global {
  interface Window {
    go?: {
      main: {
        App: {
          GetDatasourcePath(): Promise<string>;
          GetFileList(path: string): Promise<string[]>;
          ReadFile(path: string): Promise<string>;
          SetNewDatasource(path: string): Promise<boolean>;
          CreateFolder(parentId: string, name: string): Promise<string>;
          DeleteNode(id: string): Promise<boolean>;
          MoveNode(itemId: string, targetFolderId: string): Promise<boolean>;
          SaveFile(name: string, content: string, parentId: string): Promise<string>;
          AnalyzeText(text: string): Promise<string>;
        }
      }
    }
  }
}

// --- Types ---
type FileType = 'folder' | 'pdf' | 'txt' | 'csv' | 'md';

interface FileNode {
  id: string;
  name: string;
  type: FileType;
  isOpen?: boolean;
  children?: FileNode[];
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

interface DiffChunk {
  id: string;
  type: 'diff' | 'unchanged';
  text?: string;
  lines?: DiffLine[];
  reason?: string;
  originalText?: string;
  suggestedText?: string;
  applied?: boolean;
}

interface ToastType {
  message: string;
  type: 'success' | 'error' | 'info';
}

type LayoutMode = 'horizontal' | 'vertical';

type ModalState = 
  | { type: 'none' }
  | { type: 'createFolder', targetParentId: string | null }
  | { type: 'deleteConfirm', id: string, name: string }
  | { type: 'saveFreeText' }
  | { type: 'dataSource' };

// ============================================================================
// Wails Backend API Wrapper
// ============================================================================
const backendAPI = {
  getDatasourcePath: async (): Promise<string> => {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.GetDatasourcePath) {
      return await window.go.main.App.GetDatasourcePath();
    }
    // Mock
    return new Promise(resolve => setTimeout(() => resolve("C:/SampleProject"), 200));
  },
  getFileList: async (path: string): Promise<string[]> => {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.GetFileList) {
      return await window.go.main.App.GetFileList(path);
    }
    // Mock
    return new Promise(resolve => setTimeout(() => resolve([
      "プロジェクト資料/要件定義書.pdf",
      "プロジェクト資料/ミーティングメモ.txt",
      "README.txt"
    ]), 400));
  },
  readFile: async (path: string): Promise<string> => {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.ReadFile) {
      return await window.go.main.App.ReadFile(path);
    }
    // Mock
    return new Promise(resolve => setTimeout(() => {
      if (path.endsWith('README.txt')) resolve("このツールはWails(Go+React)で動作させることを想定したGUIです。\n\n【追加機能】\n・初期化時にGoからパスリストを取得し、ツリーを構築します。\n・ファイルクリック時にGoのReadFile()を呼んで内容を取得します。");
      else if (path.endsWith('.pdf')) resolve("【要件定義書】\n\n1. 目的\n本システムは、社内のファイル共有を目的とする。\n\n2. 対象ユーザー\n全社員");
      else resolve("2026年3月17日 ミーティング\n\n- UIデザインの確認\n- 左側にファイルツリー\n- 右側にプレビュー\n- 送信機能について協議\n\n以上を確認します。");
    }, 300));
  },
  setNewDatasource: async (path: string): Promise<boolean> => {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.SetNewDatasource) {
      return await window.go.main.App.SetNewDatasource(path);
    }
    return new Promise(resolve => setTimeout(() => resolve(true), 400));
  },
  createFolder: async (parentId: string | null, name: string): Promise<string> => {
    const pId = parentId || "";
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.CreateFolder) {
      return await window.go.main.App.CreateFolder(pId, name);
    }
    return new Promise(resolve => setTimeout(() => resolve(`${pId ? pId + '/' : ''}${name}`), 200));
  },
  deleteItem: async (id: string): Promise<boolean> => {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.DeleteNode) {
      return await window.go.main.App.DeleteNode(id);
    }
    return new Promise(resolve => setTimeout(() => resolve(true), 200));
  },
  moveItem: async (itemId: string, targetFolderId: string | null): Promise<boolean> => {
    const tId = targetFolderId || "";
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.MoveNode) {
      return await window.go.main.App.MoveNode(itemId, tId);
    }
    return new Promise(resolve => setTimeout(() => resolve(true), 200));
  },
  saveFile: async (name: string, content: string, parentId: string | null): Promise<string> => {
    const pId = parentId || "";
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.SaveFile) {
      return await window.go.main.App.SaveFile(name, content, pId);
    }
    return new Promise(resolve => setTimeout(() => resolve(`${pId ? pId + '/' : ''}${name}`), 200));
  },
  analyzeText: async (text: string): Promise<string> => {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.AnalyzeText) {
      return await window.go.main.App.AnalyzeText(text);
    }
    let suggested = text;
    const replacements = [
      { target: '目的とする。', replacement: '目的としています。' },
      { target: '全社員', replacement: '全従業員（契約社員・アルバイト含む）' },
      { target: '協議', replacement: 'ディスカッション' }
    ];
    replacements.forEach(({target, replacement}) => {
      if (suggested.includes(target)) suggested = suggested.replace(target, replacement);
    });
    return new Promise(resolve => setTimeout(() => resolve(suggested), 800));
  }
};

// ============================================================================
// Tree Utils
// ============================================================================
// パスの配列からツリー構造を構築する
const buildTreeFromPaths = (paths: string[]): FileNode[] => {
  const root: FileNode[] = [];
  
  paths.forEach(path => {
    const parts = path.split(/[/\\]/); // スラッシュまたはバックスラッシュで分割
    let currentLevel = root;
    let currentPathId = '';

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPathId += (currentPathId === '' ? '' : '/') + part;

      let existingNode = currentLevel.find(n => n.name === part);

      if (!existingNode) {
        let type: FileType = 'folder';
        if (isFile) {
          const ext = part.split('.').pop()?.toLowerCase();
          type = (ext === 'pdf' || ext === 'txt' || ext === 'csv' || ext === 'md') ? (ext as FileType) : 'txt';
        }

        existingNode = {
          id: currentPathId,
          name: part,
          type: type,
          isOpen: true, // 初期状態は開いておく
          children: isFile ? undefined : []
        };
        currentLevel.push(existingNode);
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });
  
  return root;
};

const findNode = (nodes: FileNode[], id: string): FileNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findParentId = (nodes: FileNode[], targetId: string, currentParentId: string | null = null): string | null => {
  for (const node of nodes) {
    if (node.id === targetId) return currentParentId;
    if (node.children) {
      const found = findParentId(node.children, targetId, node.id);
      if (found !== null) return found;
    }
  }
  return null;
};

const deleteNodeById = (nodes: FileNode[], id: string): FileNode[] => {
  return nodes
    .filter(node => node.id !== id)
    .map(node => ({
      ...node,
      children: node.children ? deleteNodeById(node.children, id) : undefined
    }));
};

const insertNodeToParent = (nodes: FileNode[], parentId: string | null, newNode: FileNode): FileNode[] => {
  if (parentId === null || parentId === "") return [...nodes, newNode];
  return nodes.map(node => {
    if (node.id === parentId && node.type === 'folder') {
      return { ...node, isOpen: true, children: [...(node.children || []), newNode] };
    }
    if (node.children) {
      return { ...node, children: insertNodeToParent(node.children, parentId, newNode) };
    }
    return node;
  });
};

const getFolderOptions = (nodes: FileNode[], prefix: string = ''): {id: string, name: string}[] => {
  let options: {id: string, name: string}[] = [];
  nodes.forEach(node => {
    if (node.type === 'folder') {
      options.push({ id: node.id, name: prefix + node.name });
      if (node.children) options = options.concat(getFolderOptions(node.children, prefix + node.name + ' / '));
    }
  });
  return options;
};

const isDescendant = (nodes: FileNode[], parentId: string, childId: string): boolean => {
  const parent = findNode(nodes, parentId);
  if (!parent || !parent.children) return false;
  return findNode(parent.children, childId) !== null;
};

// --- Diff Utils ---
const calculateDiff = (oldStr: string, newStr: string): DiffLine[] => {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const dp: number[][] = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));
  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  let i = oldLines.length, j = newLines.length;
  const res: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      res.unshift({ type: 'unchanged', text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      res.unshift({ type: 'added', text: newLines[j - 1] });
      j--;
    } else {
      res.unshift({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }
  return res;
};

const generateChunks = (lines: DiffLine[]): DiffChunk[] => {
  const chunks: DiffChunk[] = [];
  let currentGroup: DiffLine[] = [];
  const flush = () => {
    if (currentGroup.length > 0) {
      chunks.push({
        id: Math.random().toString(36).substring(2, 11),
        type: 'diff',
        lines: [...currentGroup],
        reason: "表現の改善案があります。",
        originalText: currentGroup.filter(l => l.type === 'removed').map(l => l.text).join('\n'),
        suggestedText: currentGroup.filter(l => l.type === 'added').map(l => l.text).join('\n'),
        applied: false
      });
      currentGroup = [];
    }
  };
  lines.forEach(line => {
    if (line.type === 'unchanged') {
      flush();
      chunks.push({ id: Math.random().toString(36).substring(2, 11), type: 'unchanged', text: line.text });
    } else {
      currentGroup.push(line);
    }
  });
  flush();
  return chunks;
};


// ============================================================================
// ★ 共通ツリーコンポーネント
// ============================================================================
interface TreeProps {
  nodes: FileNode[];
  depth?: number;
  selectedId?: string;
  isFreeMode?: boolean;
  dragOverId?: string | null;
  readOnly?: boolean; 
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  onDelete?: (id: string, name: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
}

const FileTreeView: React.FC<TreeProps> = ({
  nodes, depth = 0, selectedId, isFreeMode, dragOverId, readOnly = false,
  onSelect, onToggle, onDelete, onDragStart, onDragOver, onDragLeave, onDrop
}) => {
  if (!nodes || nodes.length === 0) return null;

  return (
    <>
      {nodes.map(node => {
        const isSelected = selectedId === node.id && !isFreeMode && !readOnly;
        const isOver = dragOverId === node.id && !readOnly;

        return (
          <div key={node.id}>
            <div 
              draggable={!readOnly}
              onDragStart={(e) => !readOnly && onDragStart && onDragStart(e, node.id)}
              onDragOver={(e) => { e.preventDefault(); !readOnly && onDragOver && onDragOver(e, node.id); }}
              onDragLeave={() => !readOnly && onDragLeave && onDragLeave()}
              onDrop={(e) => { e.preventDefault(); !readOnly && onDrop && onDrop(e, node.id); }}
              onClick={(e) => {
                if (readOnly) {
                  if (node.type === 'folder' && onToggle) onToggle(node.id);
                  return;
                }
                if (onSelect) onSelect(node.id);
                if (node.type === 'folder' && onToggle) onToggle(node.id);
              }}
              className={`group flex items-center justify-between py-1 px-2 cursor-pointer text-sm transition-colors 
                ${isSelected ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-200'} 
                ${isOver ? 'bg-blue-200 ring-2 ring-blue-400' : ''}
                ${readOnly ? 'hover:bg-gray-100 cursor-default' : ''}
              `}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <div className="flex items-center flex-1 overflow-hidden">
                {node.type === 'folder' ? (
                  <>
                    <span className="mr-1 text-gray-400 flex-shrink-0 cursor-pointer">
                      {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <Folder className={`mr-2 flex-shrink-0 ${readOnly ? 'text-gray-400' : 'text-blue-500'}`} size={16} />
                  </>
                ) : (
                  <FileText className={`mr-2 flex-shrink-0 ${node.type === 'pdf' ? 'text-red-400' : 'text-gray-400'}`} size={16} style={{ marginLeft: '20px' }} />
                )}
                <span className={`truncate ${readOnly && node.type !== 'folder' ? 'text-gray-500' : ''}`}>{node.name}</span>
              </div>
              
              {!readOnly && onDelete && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name); }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 text-gray-400 transition-opacity flex-shrink-0"
                  title="削除"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {node.isOpen && node.children && (
              <FileTreeView 
                nodes={node.children} depth={depth + 1} 
                selectedId={selectedId} isFreeMode={isFreeMode} dragOverId={dragOverId} readOnly={readOnly}
                onSelect={onSelect} onToggle={onToggle} onDelete={onDelete}
                onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              />
            )}
          </div>
        );
      })}
    </>
  );
};


// ============================================================================
// Main Application Component
// ============================================================================
export default function App() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [contents, setContents] = useState<Record<string, string>>({
    'free-mode': 'ここは自由記述モードです。\n\n入力して「保存」を押すとフォルダを選んでファイル化できます。\n「送信」を押すとAI分析が始まります。'
  });
  const [selectedId, setSelectedId] = useState<string>('');
  const [isFreeMode, setIsFreeMode] = useState<boolean>(true); 
  
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [isContentLoading, setIsContentLoading] = useState<boolean>(false);
  const [diffResults, setDiffResults] = useState<Record<string, DiffChunk[]>>({});
  
  const [toast, setToast] = useState<ToastType | null>(null);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [innerPopup, setInnerPopup] = useState<string | null>(null);

  const [showLeft, setShowLeft] = useState<boolean>(true);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [layout, setLayout] = useState<LayoutMode>('horizontal');
  const [autoExpand, setAutoExpand] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [dsPath, setDsPath] = useState<string>('');
  const [dsNodes, setDsNodes] = useState<FileNode[]>([]);

  const [leftWidth, setLeftWidth] = useState<number>(260);
  const [rightWidth, setRightWidth] = useState<number>(450);
  const [bottomHeight, setBottomHeight] = useState<number>(300);
  const [dragType, setDragType] = useState<'none' | 'left' | 'right' | 'bottom'>('none');
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // ★ 初期化: Goからパスを取得しツリーを構築
  // ============================================================================
  useEffect(() => {
    const initData = async () => {
      setIsLoadingTree(true);
      try {
        const rootPath = await backendAPI.getDatasourcePath();
        setDsPath(rootPath);
        
        const pathList = await backendAPI.getFileList(rootPath);
        if (pathList && pathList.length > 0) {
          const tree = buildTreeFromPaths(pathList);
          setFiles(tree);
          
          const firstFile = pathList.find(p => !p.endsWith('/')); 
          if (firstFile) {
             handleSelectFile(firstFile);
          }
        }
      } catch (e) {
        console.error(e);
        showToast("データソースの初期化に失敗しました", "error");
      } finally {
        setIsLoadingTree(false);
      }
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const closeSettings = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener("mousedown", closeSettings);
    return () => document.removeEventListener("mousedown", closeSettings);
  }, []);

  const activeId = isFreeMode ? 'free-mode' : selectedId;
  const activeNode = isFreeMode ? null : findNode(files, selectedId);
  const currentDiff = diffResults[activeId] || [];

  const showToast = (message: string, type: ToastType['type'] = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ============================================================================
  // DataSource Processing
  // ============================================================================
  const handleDataSourceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    
    const samplePath = fileList[0].webkitRelativePath;
    const rootName = samplePath.split('/')[0] || '選択されたフォルダ';
    setDsPath(rootName);

    const paths = Array.from(fileList).map(f => f.webkitRelativePath);
    const tree = buildTreeFromPaths(paths);
    setDsNodes(tree);
  };

  const handleDsToggle = (id: string) => {
    const toggle = (list: FileNode[]): FileNode[] => list.map(n => 
      n.id === id ? { ...n, isOpen: !n.isOpen } : { ...n, children: n.children ? toggle(n.children) : undefined }
    );
    setDsNodes(prev => toggle(prev));
  };


  // ============================================================================
  // Handlers
  // ============================================================================
  const handleSelectFile = async (id: string) => {
    setSelectedId(id);
    setIsFreeMode(false);
    setInnerPopup(null);
    
    const node = findNode(files, id);
    if (node && node.type !== 'folder') {
      setIsContentLoading(true);
      try {
        const content = await backendAPI.readFile(id);
        setContents(prev => ({ ...prev, [id]: content }));
      } catch (e) {
        console.error(e);
        showToast("ファイルの読み込みに失敗しました", "error");
      } finally {
        setIsContentLoading(false);
      }
    }
  };

  const handleCreateFolder = async (name: string) => {
    const parentId = activeNode ? (activeNode.type === 'folder' ? activeNode.id : findParentId(files, activeNode.id)) : null;
    setModal({ type: 'none' });
    setIsLoadingTree(true);
    try {
      const id = await backendAPI.createFolder(parentId, name);
      const newNode: FileNode = { id, name, type: 'folder', isOpen: true, children: [] };
      setFiles(prev => insertNodeToParent(prev, parentId, newNode));
      showToast("フォルダを作成しました");
    } catch (e) { showToast("エラーが発生しました", "error"); }
    finally { setIsLoadingTree(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    setModal({ type: 'none' });
    setIsLoadingTree(true);
    try {
      await backendAPI.deleteItem(id);
      setFiles(prev => deleteNodeById(prev, id));
      if (selectedId === id || isDescendant(files, id, selectedId)) setSelectedId('');
      showToast(`${name}を削除しました`);
    } catch (e) { showToast("削除に失敗しました", "error"); }
    finally { setIsLoadingTree(false); }
  };

  const handleSaveFreeText = async (name: string, folderId: string | null) => {
    const fileName = name.includes('.') ? name : `${name}.txt`;
    const content = contents['free-mode'] || '';
    setModal({ type: 'none' });
    setIsLoadingTree(true);
    try {
      const id = await backendAPI.saveFile(fileName, content, folderId);
      const newNode: FileNode = { id, name: fileName, type: 'txt' };
      setFiles(prev => insertNodeToParent(prev, folderId, newNode));
      setContents(prev => ({ ...prev, [id]: content }));
      setIsFreeMode(false);
      setSelectedId(id);
      showToast("保存しました");
    } catch (e) { showToast("保存に失敗しました", "error"); }
    finally { setIsLoadingTree(false); }
  };

  const handleSend = async () => {
    if (!activeId) return;
    setIsSending(true);
    setInnerPopup(null);
    try {
      const original = contents[activeId] || '';
      const suggested = await backendAPI.analyzeText(original);
      
      if (original === suggested) {
        setDiffResults(prev => ({ ...prev, [activeId]: [] }));
        setInnerPopup("文章に変更提案はありませんでした。");
        if (autoExpand) setShowResult(true);
      } else {
        const diffLines = calculateDiff(original, suggested);
        const chunks = generateChunks(diffLines);
        setDiffResults(prev => ({ ...prev, [activeId]: chunks }));
        if (autoExpand) setShowResult(true);
      }
    } catch (e) { showToast("通信エラー", "error"); }
    finally { setIsSending(false); }
  };

  const applySuggestion = (chunkId: string, original: string, suggested: string) => {
    setContents(prev => ({
      ...prev,
      [activeId]: (prev[activeId] || '').replace(original, suggested)
    }));
    setDiffResults(prev => ({
      ...prev,
      [activeId]: (prev[activeId] || []).map(c => c.id === chunkId ? { ...c, applied: true } : c)
    }));
    showToast("修正を適用しました");
  };

  const handleTreeToggle = (id: string) => {
    const toggle = (list: FileNode[]): FileNode[] => list.map(n => 
      n.id === id ? { ...n, isOpen: !n.isOpen } : { ...n, children: n.children ? toggle(n.children) : undefined }
    );
    setFiles(prev => toggle(prev));
  };

  // --- Resize ---
  const handleMouseMove = (e: MouseEvent) => {
    if (dragType === 'left') setLeftWidth(Math.max(150, Math.min(window.innerWidth - 300, e.clientX)));
    if (dragType === 'right') setRightWidth(Math.max(200, Math.min(window.innerWidth - 300, window.innerWidth - e.clientX)));
    if (dragType === 'bottom') setBottomHeight(Math.max(100, Math.min(window.innerHeight - 200, window.innerHeight - e.clientY)));
  };
  const stopDrag = () => setDragType('none');

  useEffect(() => {
    if (dragType !== 'none') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [dragType]);


  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden select-none">
      
      {/* --- Sidebar --- */}
      <div 
        className="flex flex-col bg-white border-r border-gray-200 transition-[width] duration-200 ease-in-out relative z-10 flex-shrink-0 overflow-hidden"
        style={{ width: showLeft ? leftWidth : 0 }}
      >
        <div className="flex flex-col h-full overflow-hidden" style={{ width: leftWidth, minWidth: leftWidth }}>
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">Input Mode</span>
              <button 
                onClick={() => setIsFreeMode(!isFreeMode)}
                className={`w-10 h-5 rounded-full p-1 transition-colors ${isFreeMode ? 'bg-amber-400' : 'bg-gray-300'}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isFreeMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex justify-between w-full px-1 mb-4 text-[11px] font-semibold text-gray-400">
              <span className={!isFreeMode ? 'text-blue-600' : ''}>ファイル</span>
              <span className={isFreeMode ? 'text-amber-600' : ''}>自由記述</span>
            </div>
            {!isFreeMode && (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setModal({ type: 'createFolder', targetParentId: null })}
                  className="flex items-center justify-center py-1.5 bg-white border border-gray-200 rounded shadow-sm text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  disabled={isLoadingTree}
                ><FolderPlus size={14} className="mr-2 text-blue-500" />フォルダ追加</button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center py-1.5 bg-white border border-gray-200 rounded shadow-sm text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  disabled={isLoadingTree}
                ><Upload size={14} className="mr-2 text-gray-500" />ファイル追加</button>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.pdf,.md,.csv" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setIsLoadingTree(true);
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  try {
                    const content = ev.target?.result as string;
                    const parentId = activeNode?.type === 'folder' ? activeNode.id : findParentId(files, activeNode?.id || '');
                    const newId = await backendAPI.uploadFile(file.name, content, parentId);
                    setFiles(prev => insertNodeToParent(prev, parentId, { id: newId, name: file.name, type: file.name.endsWith('.pdf') ? 'pdf' : 'txt' }));
                    setContents(prev => ({ ...prev, [newId]: content }));
                    setSelectedId(newId); setIsFreeMode(false);
                    showToast("追加しました");
                  } catch (err) { showToast("追加失敗", "error"); }
                  finally { setIsLoadingTree(false); }
                };
                reader.readAsText(file);
              }
              if (fileInputRef.current) fileInputRef.current.value = '';
            }} />
          </div>
          
          <div className="flex-1 overflow-y-auto py-2 relative">
            {isFreeMode ? (
               <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400">
                 <Edit3 size={32} className="mb-3 text-amber-300" />
                 <p className="font-medium text-sm text-gray-600">自由記述モード</p>
                 <p className="text-xs mt-2 leading-relaxed">右のエディタに直接入力してください。</p>
               </div>
            ) : (
              <>
                {isLoadingTree && <div className="absolute inset-0 bg-white/50 z-20 flex justify-center pt-4"><Loader2 className="animate-spin text-blue-400" size={20} /></div>}
                <div 
                  className={`min-h-full ${dragOverId === null ? 'bg-transparent' : 'bg-blue-50/50'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(null); }}
                  onDrop={async (e) => {
                    e.preventDefault(); setDragOverId(null);
                    const draggedId = e.dataTransfer.getData('nodeId');
                    if (!draggedId) return;
                    setIsLoadingTree(true);
                    try {
                      await backendAPI.moveItem(draggedId, null);
                      const draggedNode = findNode(files, draggedId);
                      if (draggedNode) setFiles(prev => insertNodeToParent(deleteNodeById(prev, draggedId), null, draggedNode));
                    } catch (err) {}
                    finally { setIsLoadingTree(false); }
                  }}
                >
                  <FileTreeView 
                    nodes={files}
                    selectedId={selectedId}
                    isFreeMode={isFreeMode}
                    dragOverId={dragOverId}
                    onSelect={handleSelectFile}
                    onToggle={handleTreeToggle}
                    onDelete={(id, name) => setModal({ type: 'deleteConfirm', id, name })}
                    onDragStart={(e, id) => e.dataTransfer.setData('nodeId', id)}
                    onDragOver={(e, id) => { e.preventDefault(); setDragOverId(id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={async (e, targetId) => {
                      e.preventDefault(); setDragOverId(null);
                      const draggedId = e.dataTransfer.getData('nodeId');
                      if (draggedId === targetId) return;
                      if (isDescendant(files, draggedId, targetId)) { showToast("無効な移動です", "error"); return; }
                      setIsLoadingTree(true);
                      const targetParent = findNode(files, targetId)?.type === 'folder' ? targetId : findParentId(files, targetId);
                      try {
                        await backendAPI.moveItem(draggedId, targetParent);
                        const draggedNode = findNode(files, draggedId);
                        if (draggedNode) setFiles(prev => insertNodeToParent(deleteNodeById(prev, draggedId), targetParent, draggedNode));
                      } catch (err) { showToast("失敗", "error"); }
                      finally { setIsLoadingTree(false); }
                    }}
                  />
                  {files.length === 0 && !isLoadingTree && <div className="text-center text-gray-400 text-xs mt-10 p-4">アイテムがありません</div>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- Resizer Left --- */}
      {showLeft && <div className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize z-20 transition-colors flex-shrink-0" onMouseDown={() => setDragType('left')} />}

      {/* --- Main Content --- */}
      <div className={`flex flex-1 overflow-hidden relative ${layout === 'vertical' ? 'flex-col' : 'flex-row'}`}>
        
        {/* Editor Pane */}
        <div className="flex-1 flex flex-col bg-white min-w-[300px]">
          <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-white z-20 flex-shrink-0">
            <div className="flex items-center flex-1 truncate">
              <button onClick={() => setShowLeft(!showLeft)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 mr-2 flex-shrink-0">
                {showLeft ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
              </button>
              {isFreeMode ? <Edit3 size={16} className="text-amber-500 mr-2 flex-shrink-0" /> : <FileText size={16} className="text-blue-500 mr-2 flex-shrink-0" />}
              <span className="font-bold truncate text-sm">{isFreeMode ? '自由記述' : (activeNode?.name || '未選択')}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isFreeMode && (
                <button 
                  onClick={() => setModal({ type: 'saveFreeText' })}
                  className="flex items-center px-3 py-1.5 border border-gray-200 rounded text-xs font-medium hover:bg-gray-50 transition-colors"
                ><Save size={14} className="mr-1.5 text-gray-500" />保存</button>
              )}
              <button 
                disabled={isSending || (!isFreeMode && (!activeNode || activeNode.type === 'folder'))}
                onClick={handleSend}
                className="flex items-center px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:bg-gray-300 shadow-sm"
              >
                {isSending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Send size={14} className="mr-1.5" />}
                送信
              </button>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              
              <div className="relative">
                <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded transition-colors ${showSettings ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-100'}`}><Settings size={18} /></button>
                {showSettings && (
                  <div ref={settingsRef} className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <span className="font-semibold text-gray-700 text-sm">設定</span>
                      <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>
                    
                    <div className="p-4 border-b border-gray-100">
                      <button 
                        onClick={() => { setShowSettings(false); setModal({ type: 'dataSource' }); }}
                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                      >
                        <Database size={16} className="mr-2 opacity-80" />
                        データソースの設定
                      </button>
                    </div>

                    <div className="p-4">
                      <span className="block text-xs font-semibold text-gray-500 mb-2">レイアウト</span>
                      <div className="flex gap-2">
                        <button onClick={() => { setLayout('horizontal'); setShowResult(true); }} className={`flex-1 py-1.5 text-xs font-medium rounded border flex items-center justify-center ${layout === 'horizontal' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}><PanelRight size={14} className="mr-1" />左右</button>
                        <button onClick={() => { setLayout('vertical'); setShowResult(true); }} className={`flex-1 py-1.5 text-xs font-medium rounded border flex items-center justify-center ${layout === 'vertical' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}><PanelBottom size={14} className="mr-1" />上下</button>
                      </div>
                      <label className="flex items-center mt-4 cursor-pointer">
                        <input type="checkbox" checked={autoExpand} onChange={e => setAutoExpand(e.target.checked)} className="mr-2" />
                        <span className="text-sm text-gray-700">送信時に結果を自動展開</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowResult(!showResult)} className={`p-1.5 rounded transition-colors ${showResult ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}>
                {layout === 'horizontal' ? <PanelRight size={18} /> : <PanelBottom size={18} />}
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-4 bg-gray-50 overflow-hidden select-text relative">
            {isContentLoading ? (
              <div className="h-full flex flex-col items-center justify-center bg-white border border-gray-200 rounded text-gray-400">
                 <Loader2 size={32} className="animate-spin text-blue-400 mb-4" />
                 <p className="text-sm">ファイルを読み込んでいます...</p>
              </div>
            ) : (!isFreeMode && activeNode?.type === 'folder') ? (
               <div className="h-full flex flex-col items-center justify-center bg-white border border-gray-200 rounded text-gray-400">
                 <FolderOpen size={48} className="mb-4 text-blue-100" />
                 <p className="text-sm">フォルダが選択されています。</p>
               </div>
            ) : (
              <textarea
                className={`w-full h-full p-4 border border-gray-200 rounded shadow-inner resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed ${isFreeMode ? 'bg-amber-50/20' : 'bg-white'}`}
                value={contents[activeId] || ''}
                onChange={(e) => {
                  setContents(prev => ({ ...prev, [activeId]: e.target.value }));
                  setInnerPopup(null);
                }}
                placeholder="ここにテキストを入力..."
                spellCheck={false}
              />
            )}
          </div>
        </div>

        {/* --- Resizer Right/Bottom --- */}
        {showResult && (
          <div 
            className={`${layout === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} bg-gray-200 hover:bg-blue-400 z-10 transition-colors flex-shrink-0`}
            onMouseDown={() => setDragType(layout === 'horizontal' ? 'right' : 'bottom')}
          />
        )}

        {/* Result Pane */}
        <div 
          className="bg-slate-50 border-gray-200 transition-[width,height] duration-200 ease-in-out flex flex-col relative overflow-hidden"
          style={{ 
            width: layout === 'horizontal' ? (showResult ? rightWidth : 0) : '100%',
            height: layout === 'vertical' ? (showResult ? bottomHeight : 0) : '100%',
            borderLeftWidth: layout === 'horizontal' && showResult ? 1 : 0,
            borderTopWidth: layout === 'vertical' && showResult ? 1 : 0
          }}
        >
          <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-slate-100 flex-shrink-0">
            <div className="flex items-center font-bold text-sm text-slate-700">
              <GitMerge size={16} className="mr-2 text-slate-500" />修正案
            </div>
            <button onClick={() => setShowResult(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 relative">
            
            {/* Inner Popup for "No Changes" */}
            {innerPopup && (
              <div className="absolute top-4 left-4 right-4 bg-gray-800 text-white p-3 rounded shadow-xl flex items-center justify-between z-50">
                <div className="flex items-center text-sm font-medium">
                  <CheckCircle size={18} className="text-green-400 mr-2 flex-shrink-0" /> {innerPopup}
                </div>
                <button onClick={() => setInnerPopup(null)} className="text-gray-400 hover:text-white p-1"><X size={14} /></button>
              </div>
            )}

            {isSending ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span className="text-xs font-medium">分析中...</span>
              </div>
            ) : currentDiff.length > 0 ? (
              <div className="space-y-4 pb-8">
                {currentDiff.map((chunk) => (
                  <div key={chunk.id}>
                    {chunk.type === 'unchanged' ? (
                      <div className="text-xs text-slate-400 font-mono pl-6 whitespace-pre-wrap">{chunk.text}</div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center">
                          <Info size={12} className="mr-1" /> AI Suggestion
                        </div>
                        <div className="p-0 font-mono text-xs select-text">
                          {(chunk.lines || []).map((line, idx) => (
                            <div key={idx} className={`px-3 py-1 flex ${line.type === 'added' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              <span className="w-5 flex-shrink-0 select-none opacity-50 font-bold">{line.type === 'added' ? '+' : '-'}</span>
                              <span className="whitespace-pre-wrap">{line.text || ' '}</span>
                            </div>
                          ))}
                        </div>
                        <div className="p-3 bg-blue-50/30 border-t border-blue-50 flex items-center justify-between gap-4">
                          <span className="text-[11px] text-blue-700 leading-tight flex items-start">
                            <MessageSquare size={12} className="mr-1.5 mt-0.5 flex-shrink-0 opacity-70" />
                            {chunk.reason}
                          </span>
                          <button 
                            disabled={chunk.applied}
                            onClick={() => applySuggestion(chunk.id, chunk.originalText || '', chunk.suggestedText || '')}
                            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all border flex-shrink-0 ${chunk.applied ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm'}`}
                          >{chunk.applied ? '適用済み' : '変更を適用'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-4">
                <GitMerge size={40} className="mb-3 opacity-20" />
                <p className="text-xs leading-relaxed font-medium">送信ボタンを押すと結果が表示されます</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Global Modals --- */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <span className="font-bold text-gray-700 flex items-center">
                {modal.type === 'createFolder' && <><FolderPlus size={18} className="mr-2 text-blue-500" />フォルダ追加</>}
                {modal.type === 'deleteConfirm' && <><AlertCircle size={18} className="mr-2 text-red-500" />削除の確認</>}
                {modal.type === 'saveFreeText' && <><Save size={18} className="mr-2 text-amber-500" />ファイルとして保存</>}
                {modal.type === 'dataSource' && <><Database size={18} className="mr-2 text-blue-500" />データソースの設定</>}
              </span>
              <button onClick={() => setModal({ type: 'none' })} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            
            <div className="p-6 bg-white">
              {modal.type === 'createFolder' && (
                <input 
                  autoFocus placeholder="フォルダ名を入力"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(e.currentTarget.value); }}
                />
              )}
              {modal.type === 'deleteConfirm' && (
                <p className="text-sm text-gray-600">「<span className="font-bold text-gray-800">{modal.name}</span>」を削除しますか？<br/><span className="text-red-500 text-xs mt-2 block">※この操作は元に戻せません。</span></p>
              )}
              {modal.type === 'saveFreeText' && (
                <div className="space-y-4">
                  <input id="save-name" placeholder="ファイル名 (例: memo.txt)" className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" defaultValue="名称未設定.txt" />
                  <select id="save-folder" className="w-full p-2 border rounded text-sm outline-none bg-white">
                    <option value="">(ルートディレクトリ)</option>
                    {getFolderOptions(files).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                  </select>
                </div>
              )}
              {/* ★ データソース設定モーダル */}
              {modal.type === 'dataSource' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500">対象フォルダを選択</label>
                    <div className="flex gap-2">
                      <input type="text" readOnly value={dsPath} placeholder="フォルダが選択されていません" className="flex-1 p-2 border rounded text-sm bg-gray-50 text-gray-600 outline-none" />
                      <button onClick={() => dirInputRef.current?.click()} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border rounded text-sm font-medium transition-colors">参照...</button>
                    </div>
                    {/* webkitdirectory を利用してフォルダ選択ダイアログを起動 */}
                    <input type="file" ref={dirInputRef} className="hidden" onChange={handleDataSourceSelect} {...{"webkitdirectory": "", "directory": ""}} />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500">プレビュー</label>
                    <div className="border border-gray-200 rounded h-48 overflow-y-auto bg-gray-50 py-2">
                      {dsNodes.length > 0 ? (
                        <FileTreeView nodes={dsNodes} readOnly={true} onToggle={handleDsToggle} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400 p-4 text-center">
                          参照ボタンからフォルダを選択すると<br/>ここに階層が表示されます。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button onClick={() => setModal({ type: 'none' })} className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors">
                キャンセル
              </button>

              {/* ★ 反映ボタン */}
              {modal.type === 'dataSource' && (
                <button 
                  disabled={dsNodes.length === 0 || isLoadingTree}
                  onClick={async () => {
                    setIsLoadingTree(true);
                    try {
                      await backendAPI.setNewDatasource(dsPath);
                      setFiles(dsNodes);
                      setSelectedId('');
                      setIsFreeMode(false); 
                      
                      setModal({ type: 'none' });
                      showToast("データソースを反映しました");
                    } catch (e) {
                      showToast("データソースの反映に失敗しました", "error");
                    } finally {
                      setIsLoadingTree(false);
                    }
                  }}
                  className="px-4 py-1.5 text-sm text-white rounded font-bold transition-colors bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >反映</button>
              )}

              {modal.type !== 'dataSource' && (
                <button 
                  onClick={() => {
                    if (modal.type === 'deleteConfirm') handleDelete(modal.id, modal.name);
                    if (modal.type === 'saveFreeText') {
                      const name = (document.getElementById('save-name') as HTMLInputElement).value;
                      const fId = (document.getElementById('save-folder') as HTMLSelectElement).value;
                      handleSaveFreeText(name, fId || null);
                    }
                  }}
                  className={`px-4 py-1.5 text-sm text-white rounded font-bold transition-colors ${modal.type === 'deleteConfirm' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                >実行</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Toast --- */}
      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center bg-gray-800 text-white px-4 py-3 rounded-lg shadow-2xl z-[110] animate-in slide-in-from-bottom-4">
          <CheckCircle size={18} className="text-green-400 mr-3" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}


