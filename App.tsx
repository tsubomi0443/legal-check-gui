import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, FolderOpen, FileText, File, Send, Upload, ChevronRight, ChevronDown,
  CheckCircle, Loader2, AlertCircle, GitMerge, MessageSquare, FileCheck,
  PanelRightClose, PanelRight, PanelBottomClose, PanelBottom, PanelLeftClose, PanelLeft,
  Settings, X, Check, Edit3, FolderPlus, Trash2, Save
} from 'lucide-react';

// --- 型定義 ---
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
  id?: string;
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
  | { type: 'saveFreeText' };

interface FolderOption {
  id: string | null;
  name: string;
}

// --- モックデータ ---
const initialFiles: FileNode[] = [
  { 
    id: 'folder-1', name: 'プロジェクト資料', type: 'folder', isOpen: true, 
    children: [
      { id: 'file-1', name: '要件定義書.pdf', type: 'pdf' },
      { id: 'file-2', name: 'ミーティングメモ.txt', type: 'txt' },
    ]
  },
  { id: 'file-3', name: 'README.txt', type: 'txt' }
];

const initialContents: Record<string, string> = {
  'file-1': '【要件定義書】\n\n1. 目的\n本システムは、社内のファイル共有を目的とする。\n\n2. 対象ユーザー\n全社員',
  'file-2': '2026年3月17日 ミーティング\n\n- UIデザインの確認\n- 左側にファイルツリー\n- 右側にプレビュー\n- 送信機能について協議\n\n以上を確認します。',
  'file-3': 'このツールはWails(Go+React)で動作させることを想定したGUIです。\n\n【更新内容】\n・自由記述モードに「保存機能」を追加しました。\n・自由記述モードで上部の「保存」ボタンを押すと、保存先のフォルダを選択してファイルとして書き出すことができます。',
  'free-mode': 'ここは自由記述モードです。\n\n自由にテキストを入力し、「保存」ボタンを押すと、ツリー内の指定したフォルダにテキストファイルとして保存できます。'
};

// ============================================================================
// Wails バックエンドAPI呼び出しのモック
// ============================================================================
const backendAPI = {
  createFolder: async (parentId: string | null, name: string): Promise<string> => {
    return new Promise(resolve => setTimeout(() => resolve(`folder-${Date.now()}`), 200));
  },
  deleteItem: async (id: string): Promise<boolean> => {
    return new Promise(resolve => setTimeout(() => resolve(true), 200));
  },
  moveItem: async (itemId: string, targetFolderId: string | null): Promise<boolean> => {
    return new Promise(resolve => setTimeout(() => resolve(true), 200));
  },
  uploadFile: async (name: string, content: string, parentId: string | null): Promise<string> => {
    return new Promise(resolve => setTimeout(() => resolve(`file-${Date.now()}`), 200));
  }
};

// ============================================================================
// ツリー操作のユーティリティ関数
// ============================================================================
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
    .map(node => {
      if (node.children) {
        return { ...node, children: deleteNodeById(node.children, id) };
      }
      return node;
    });
};

const insertNodeToParent = (nodes: FileNode[], parentId: string | null, newNode: FileNode): FileNode[] => {
  if (parentId === null) return [...nodes, newNode];
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

const isDescendant = (nodes: FileNode[], parentId: string, childId: string): boolean => {
  const parent = findNode(nodes, parentId);
  if (!parent || !parent.children) return false;
  return findNode(parent.children, childId) !== null;
};

// 保存先フォルダ一覧をフラットに取得する関数
const getFolderOptions = (nodes: FileNode[], prefix: string = ''): FolderOption[] => {
  let options: FolderOption[] = [];
  nodes.forEach(node => {
    if (node.type === 'folder') {
      options.push({ id: node.id, name: prefix + node.name });
      if (node.children) {
        options = options.concat(getFolderOptions(node.children, prefix + node.name + ' / '));
      }
    }
  });
  return options;
};

// --- AIモックとDiff ---
const simulateReview = (text: string): string => {
  let newText = text;
  const replacements = [
    { target: '目的とする。', replacement: '目的としています。' },
    { target: '全社員', replacement: '全従業員（契約社員・アルバイト含む）' },
    { target: '協議', replacement: 'ディスカッション' }
  ];
  let changedCount = 0;
  replacements.forEach(({target, replacement}) => {
    if (newText.includes(target)) {
      newText = newText.replace(target, replacement);
      changedCount++;
    }
  });
  if (changedCount === 0) {
    if (newText.trim().length > 0) newText += '\n\n【システム追記】文章のフォーマットは適切です。';
    else newText = '【システム追記】テキストが空です。内容を記述してください。';
  }
  return newText;
};

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
  let i = oldLines.length;
  let j = newLines.length;
  const result: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }
  return result;
};

const generateDiffChunks = (diffResult: DiffLine[]): DiffChunk[] => {
  const chunks: DiffChunk[] = [];
  let currentDiffLines: DiffLine[] = [];
  const reasons = ["表現をより明確にしました。", "より丁寧な語彙に置き換えました。"];
  const flushDiff = () => {
    if (currentDiffLines.length > 0) {
      chunks.push({ 
        id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'diff', lines: currentDiffLines,
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        originalText: currentDiffLines.filter(l => l.type === 'removed').map(l => l.text).join('\n'),
        suggestedText: currentDiffLines.filter(l => l.type === 'added').map(l => l.text).join('\n'),
        applied: false
      });
      currentDiffLines = [];
    }
  };
  diffResult.forEach(line => {
    if (line.type === 'unchanged') {
      flushDiff();
      chunks.push({ type: 'unchanged', text: line.text });
    } else {
      currentDiffLines.push(line);
    }
  });
  flushDiff();
  return chunks;
};

export default function App() {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [contents, setContents] = useState<Record<string, string>>(initialContents);
  const [selectedFileId, setSelectedFileId] = useState<string>('file-3');
  
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [diffResults, setDiffResults] = useState<Record<string, DiffChunk[] | null>>({});
  const [toast, setToast] = useState<ToastType | null>(null);
  
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [isFreeMode, setIsFreeMode] = useState<boolean>(false);

  // UIステート
  const [showLeftPane, setShowLeftPane] = useState<boolean>(true);
  const [showResultPane, setShowResultPane] = useState<boolean>(false);
  const [autoExpand, setAutoExpand] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');

  // DnDステート
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // リサイズステート
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(260);
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(450);
  const [bottomPaneHeight, setBottomPaneHeight] = useState<number>(300);
  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);
  const [isDraggingBottom, setIsDraggingBottom] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const saveFileInputRef = useRef<HTMLInputElement>(null);
  const saveFolderSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // モーダル表示時のフォーカス
  useEffect(() => {
    if (modal.type === 'createFolder' && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    } else if (modal.type === 'saveFreeText' && saveFileInputRef.current) {
      saveFileInputRef.current.focus();
      saveFileInputRef.current.select(); // ファイル名を全選択
    }
  }, [modal.type]);

  const effectiveFileId = isFreeMode ? 'free-mode' : selectedFileId;
  const activeFile = isFreeMode ? null : findNode(files, selectedFileId);
  const currentDiff = diffResults[effectiveFileId];

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ============================================================================
  // ツリー操作 / モーダルアクション
  // ============================================================================
  const openCreateFolderModal = () => {
    let targetParentId: string | null = null;
    if (activeFile) {
      targetParentId = activeFile.type === 'folder' ? activeFile.id : findParentId(files, activeFile.id);
    }
    setModal({ type: 'createFolder', targetParentId });
  };

  const confirmCreateFolder = async (folderName: string) => {
    folderName = folderName.trim();
    if (!folderName || modal.type !== 'createFolder') {
      setModal({ type: 'none' });
      return;
    }
    const targetParentId = modal.targetParentId;
    setModal({ type: 'none' });
    setIsLoadingTree(true);
    try {
      const newId = await backendAPI.createFolder(targetParentId, folderName);
      const newNode: FileNode = { id: newId, name: folderName, type: 'folder', isOpen: true, children: [] };
      setFiles(prev => insertNodeToParent(prev, targetParentId, newNode));
      showToast(`フォルダ「${folderName}」を作成しました`);
    } catch (e) {
      showToast('フォルダの作成に失敗しました', 'error');
    } finally {
      setIsLoadingTree(false);
    }
  };

  const openDeleteConfirmModal = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setModal({ type: 'deleteConfirm', id, name });
  };

  const confirmDelete = async () => {
    if (modal.type !== 'deleteConfirm') return;
    const { id, name } = modal;
    setModal({ type: 'none' });
    setIsLoadingTree(true);
    try {
      await backendAPI.deleteItem(id);
      if (selectedFileId === id || isDescendant(files, id, selectedFileId)) {
        setSelectedFileId('');
      }
      setFiles(prev => deleteNodeById(prev, id));
      showToast(`「${name}」を削除しました`);
    } catch (err) {
      showToast('削除に失敗しました', 'error');
    } finally {
      setIsLoadingTree(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const uploadedFile = e.target.files[0];
    let targetParentId: string | null = null;
    if (activeFile) {
      targetParentId = activeFile.type === 'folder' ? activeFile.id : findParentId(files, activeFile.id);
    }
    setIsLoadingTree(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const isPdf = uploadedFile.name.toLowerCase().endsWith('.pdf');
      const textContent = isPdf ? `[${uploadedFile.name} の抽出プレビュー]\n\n※PDFの内容` : content;
      try {
        const newId = await backendAPI.uploadFile(uploadedFile.name, textContent, targetParentId);
        const newFileNode: FileNode = { id: newId, name: uploadedFile.name, type: isPdf ? 'pdf' : 'txt' };
        setFiles(prev => insertNodeToParent(prev, targetParentId, newFileNode));
        setContents(prev => ({ ...prev, [newId]: textContent }));
        setSelectedFileId(newId);
        showToast('ファイルを追加しました');
      } catch (err) {
        showToast('ファイルの追加に失敗しました', 'error');
      } finally {
        setIsLoadingTree(false);
      }
    };
    reader.readAsText(uploadedFile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- 自由記述の保存処理 ---
  const confirmSaveFreeText = async (fileName: string, folderId: string | null) => {
    fileName = fileName.trim();
    if (!fileName) {
      showToast('ファイル名を入力してください', 'error');
      return;
    }
    // 拡張子がなければ .txt を付与
    if (!fileName.includes('.')) fileName += '.txt';

    setModal({ type: 'none' });
    setIsLoadingTree(true);

    const content = contents['free-mode'] || '';

    try {
      const newId = await backendAPI.uploadFile(fileName, content, folderId);
      const newFileNode: FileNode = { id: newId, name: fileName, type: 'txt' };
      
      setFiles(prev => insertNodeToParent(prev, folderId, newFileNode));
      setContents(prev => ({ ...prev, [newId]: content }));
      
      // 保存したらファイルモードに切り替えてそのファイルを選択状態にする
      setIsFreeMode(false);
      setSelectedFileId(newId);
      showToast(`「${fileName}」を保存しました`);
    } catch (err) {
      showToast('保存に失敗しました', 'error');
    } finally {
      setIsLoadingTree(false);
    }
  };

  // ============================================================================
  // ドラッグ＆ドロップ処理
  // ============================================================================
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('application/x-file-id', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
    if (dragOverTargetId !== targetId) setDragOverTargetId(targetId);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOverTargetId(null);
  };
  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault(); e.stopPropagation(); setDragOverTargetId(null);
    const draggedId = e.dataTransfer.getData('application/x-file-id');
    if (!draggedId || draggedId === targetFolderId) return;
    if (targetFolderId && isDescendant(files, draggedId, targetFolderId)) {
      showToast('親フォルダを自身の子フォルダに移動することはできません', 'error'); return;
    }
    const currentParentId = findParentId(files, draggedId);
    if (currentParentId === targetFolderId) return;
    const draggedNode = findNode(files, draggedId);
    if (!draggedNode) return;
    setIsLoadingTree(true);
    try {
      await backendAPI.moveItem(draggedId, targetFolderId);
      setFiles(prev => {
        const withoutNode = deleteNodeById(prev, draggedId);
        return insertNodeToParent(withoutNode, targetFolderId, draggedNode);
      });
      showToast('アイテムを移動しました');
    } catch (err) {
      showToast('移動に失敗しました', 'error');
    } finally {
      setIsLoadingTree(false);
    }
  };

  const handleToggleFolder = (e: React.MouseEvent<HTMLDivElement>, folderId: string) => {
    e.stopPropagation();
    setFiles(prev => {
      const toggle = (nodes: FileNode[]): FileNode[] => nodes.map(n => {
        if (n.id === folderId && n.type === 'folder') return { ...n, isOpen: !n.isOpen };
        if (n.children) return { ...n, children: toggle(n.children) };
        return n;
      });
      return toggle(prev);
    });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContents({ ...contents, [effectiveFileId]: e.target.value });
    setDiffResults(prev => ({ ...prev, [effectiveFileId]: null }));
    setShowResultPane(false);
  };

  const handleSend = () => {
    if (!effectiveFileId) return;
    setIsSending(true);
    setTimeout(() => {
      const currentText = contents[effectiveFileId] || '';
      const suggestedText = simulateReview(currentText); 
      const rawDiff = calculateDiff(currentText, suggestedText);
      const chunks = generateDiffChunks(rawDiff);
      
      setDiffResults(prev => ({ ...prev, [effectiveFileId]: chunks }));
      setIsSending(false);
      if (autoExpand) setShowResultPane(true);
      showToast('修正案を受信しました', 'success');
    }, 1500);
  };

  const handleApplySuggestion = (chunkId?: string, originalText?: string, suggestedText?: string) => {
    if (!chunkId || !suggestedText) return;
    setContents(prev => {
      const currentText = prev[effectiveFileId] || '';
      let newText = originalText ? currentText.replace(originalText, suggestedText) : currentText + '\n' + suggestedText;
      return { ...prev, [effectiveFileId]: newText };
    });
    setDiffResults(prev => {
      const currentDiffs = prev[effectiveFileId];
      if (!currentDiffs) return prev;
      return { ...prev, [effectiveFileId]: currentDiffs.map(c => c.id === chunkId ? { ...c, applied: true } : c) };
    });
    showToast('提案内容を元文へ適用しました', 'success');
  };

  // --- リサイズ ---
  const makeResizeHandler = (setter: React.Dispatch<React.SetStateAction<number>>, isX: boolean, min: number, maxRatio: number, reverse: boolean = false) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startVal = isX ? e.clientX : e.clientY;
    const startSize = isX ? (reverse ? rightPaneWidth : leftPaneWidth) : bottomPaneHeight;
    const max = (isX ? window.innerWidth : window.innerHeight) * maxRatio;
    const onMove = (moveEvent: MouseEvent) => {
      const diff = (isX ? moveEvent.clientX : moveEvent.clientY) - startVal;
      setter(Math.max(min, Math.min(max, startSize + (reverse ? -diff : diff))));
    };
    const onUp = () => {
      setIsDraggingLeft(false); setIsDraggingRight(false); setIsDraggingBottom(false);
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
    };
    if(isX && !reverse) setIsDraggingLeft(true); else if(isX) setIsDraggingRight(true); else setIsDraggingBottom(true);
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };

  const renderTree = (nodes: FileNode[], depth: number = 0): React.ReactNode => {
    return nodes.map(node => {
      const isSelected = selectedFileId === node.id;
      const isDragOver = dragOverTargetId === node.id;

      if (node.type === 'folder') {
        return (
          <div key={node.id}>
            <div 
              draggable
              onDragStart={(e) => handleDragStart(e, node.id)}
              onDragOver={(e) => handleDragOver(e, node.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, node.id)}
              className={`group flex items-center justify-between py-1.5 px-2 pr-3 cursor-pointer text-sm transition-colors ${
                isDragOver ? 'bg-blue-200 ring-2 ring-blue-400 z-10 relative' :
                isSelected && !isFreeMode ? 'bg-blue-100/50 text-blue-800' : 'hover:bg-gray-200 text-gray-700'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={(e) => { 
                setSelectedFileId(node.id); 
                setIsFreeMode(false);
                handleToggleFolder(e, node.id); 
              }}
            >
              <div className="flex items-center flex-1 overflow-hidden">
                <span className="mr-1 flex-shrink-0 text-gray-500">{node.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                <span className="mr-2 flex-shrink-0 text-blue-500">{node.isOpen ? <FolderOpen size={16} /> : <Folder size={16} />}</span>
                <span className="truncate select-none">{node.name}</span>
              </div>
              <button 
                onClick={(e) => openDeleteConfirmModal(e, node.id, node.name)}
                className="p-1 ml-2 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 flex-shrink-0 bg-gray-50 hover:bg-red-50"
                title="削除"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {node.isOpen && node.children && <div>{renderTree(node.children, depth + 1)}</div>}
          </div>
        );
      }
      return (
        <div 
          key={node.id}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
          className={`group flex items-center justify-between py-1.5 px-2 pr-3 cursor-pointer text-sm transition-colors ${
            isSelected && !isFreeMode ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-700'
          }`}
          style={{ paddingLeft: `${depth * 16 + 28}px` }}
          onClick={() => { setSelectedFileId(node.id); setIsFreeMode(false); }}
        >
          <div className="flex items-center flex-1 overflow-hidden">
            <span className={`mr-2 flex-shrink-0 ${node.type === 'pdf' ? 'text-red-500' : 'text-gray-500'}`}>
              {node.type === 'pdf' ? <FileText size={16} /> : <File size={16} />}
            </span>
            <span className="truncate select-none">{node.name}</span>
          </div>
          <button 
            onClick={(e) => openDeleteConfirmModal(e, node.id, node.name)}
            className="p-1 ml-2 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 flex-shrink-0 bg-white hover:bg-red-50"
            title="削除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      );
    });
  };

  return (
    <div 
      className={`flex h-screen bg-gray-100 text-gray-800 font-sans overflow-hidden relative ${
        (isDraggingLeft || isDraggingRight) ? 'select-none cursor-col-resize' : 
        isDraggingBottom ? 'select-none cursor-row-resize' : ''
      }`}
    >
      {/* === モーダル領域 === */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          
          {modal.type === 'createFolder' && (
            <div className="bg-white rounded-lg shadow-xl w-80 overflow-hidden">
              <div className="p-4 border-b border-gray-200 font-semibold text-gray-700 flex items-center">
                <FolderPlus size={18} className="mr-2 text-blue-600" />フォルダを追加
              </div>
              <div className="p-4">
                <input 
                  type="text" ref={newFolderInputRef} placeholder="新しいフォルダ名"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmCreateFolder(e.currentTarget.value);
                    if (e.key === 'Escape') setModal({type: 'none'});
                  }}
                />
              </div>
              <div className="p-3 bg-gray-50 flex justify-end space-x-2">
                <button onClick={() => setModal({type: 'none'})} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors">キャンセル</button>
                <button onClick={() => confirmCreateFolder(newFolderInputRef.current?.value || '')} className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors">作成</button>
              </div>
            </div>
          )}

          {modal.type === 'deleteConfirm' && (
            <div className="bg-white rounded-lg shadow-xl w-80 overflow-hidden">
              <div className="p-4 border-b border-gray-200 font-semibold text-gray-700 flex items-center text-red-600">
                <AlertCircle size={18} className="mr-2" />削除の確認
              </div>
              <div className="p-4 text-sm text-gray-600 leading-relaxed">
                「<span className="font-semibold text-gray-800">{modal.name}</span>」を削除してもよろしいですか？<br/><br/>
                <span className="text-red-500 text-xs">※この操作は元に戻せません。フォルダの場合は中身もすべて削除されます。</span>
              </div>
              <div className="p-3 bg-gray-50 flex justify-end space-x-2">
                <button onClick={() => setModal({type: 'none'})} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors">キャンセル</button>
                <button onClick={confirmDelete} className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors">削除する</button>
              </div>
            </div>
          )}

          {modal.type === 'saveFreeText' && (
            <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden">
              <div className="p-4 border-b border-gray-200 font-semibold text-gray-700 flex items-center">
                <Save size={18} className="mr-2 text-blue-600" />
                自由記述を保存
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ファイル名</label>
                  <input 
                    type="text" 
                    ref={saveFileInputRef}
                    defaultValue="名称未設定.txt"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmSaveFreeText(saveFileInputRef.current?.value || '', saveFolderSelectRef.current?.value || null);
                      if (e.key === 'Escape') setModal({type: 'none'});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">保存先フォルダ</label>
                  <select 
                    ref={saveFolderSelectRef}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">(最上位ルートに保存)</option>
                    {getFolderOptions(files).map(opt => (
                      <option key={opt.id || 'root'} value={opt.id || ''}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-3 bg-gray-50 flex justify-end space-x-2">
                <button onClick={() => setModal({type: 'none'})} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors">キャンセル</button>
                <button 
                  onClick={() => confirmSaveFreeText(saveFileInputRef.current?.value || '', saveFolderSelectRef.current?.value || null)} 
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === 左ペイン === */}
      <div 
        className={`flex-shrink-0 bg-gray-50 flex flex-col z-10 shadow-sm overflow-hidden ${(!isDraggingLeft && !isDraggingRight && !isDraggingBottom) ? 'transition-[width] duration-300 ease-in-out' : ''}`}
        style={{ width: showLeftPane ? leftPaneWidth : 0 }}
      >
        <div className="flex flex-col h-full bg-gray-50" style={{ width: leftPaneWidth, minWidth: leftPaneWidth }}>
          <div className="p-3 border-b border-gray-200 bg-gray-100 flex flex-col items-center justify-center relative">
            <div className="text-[10px] font-bold text-gray-500 mb-1.5 tracking-widest uppercase">Input Mode</div>
            <div 
              onClick={() => setIsFreeMode(!isFreeMode)}
              className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors duration-300 flex items-center p-1 ${isFreeMode ? 'bg-amber-400' : 'bg-slate-300'}`}
              style={{ boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(255,255,255,0.4)' }}
            >
              <div 
                className={`absolute w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${isFreeMode ? 'translate-x-7 bg-white' : 'translate-x-0 bg-white'}`}
                style={{ border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.8)' }}
              >
                <div className="w-1 h-2.5 bg-gray-300 rounded-full shadow-inner opacity-60"></div>
              </div>
            </div>
            <div className="flex justify-between w-full px-5 mt-1.5 text-[11px] font-semibold select-none">
              <span className={!isFreeMode ? 'text-blue-600' : 'text-gray-400 transition-colors'}>ファイル</span>
              <span className={isFreeMode ? 'text-amber-600' : 'text-gray-400 transition-colors'}>自由記述</span>
            </div>
          </div>

          {isFreeMode ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-gray-50/50">
              <Edit3 size={32} className="mb-3 text-amber-200" />
              <p className="font-medium text-sm text-gray-600">自由記述モード</p>
              <p className="text-xs mt-2 leading-relaxed">エディタに直接テキストを<br/>入力してください。</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="p-3 border-b border-gray-200 bg-white shadow-sm z-10 flex flex-col gap-2 relative">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.pdf,.csv,.md" />
                <button 
                  onClick={openCreateFolderModal}
                  disabled={isLoadingTree}
                  className="w-full flex items-center justify-center py-1.5 px-3 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                >
                  <FolderPlus size={16} className="mr-2 text-blue-500" />
                  <span className="truncate">フォルダを追加</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoadingTree}
                  className="w-full flex items-center justify-center py-1.5 px-3 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Upload size={16} className="mr-2 text-gray-500" />
                  <span className="truncate">ファイルを追加</span>
                </button>
              </div>

              <div 
                className={`flex-1 overflow-y-auto py-2 transition-colors relative ${dragOverTargetId === null ? '' : 'bg-blue-50/50'}`}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
              >
                {isLoadingTree && (
                  <div className="absolute inset-0 bg-white/50 z-20 flex justify-center pt-10">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                  </div>
                )}
                {dragOverTargetId === null && (
                  <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-400 m-2 rounded-lg opacity-50 z-10"></div>
                )}

                {renderTree(files)}
                
                {files.length === 0 && !isLoadingTree && (
                  <div className="text-center text-gray-400 text-xs mt-10 p-4 pointer-events-none">
                    フォルダは空です。<br/>上部のボタンから作成してください。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLeftPane && (
        <div 
          className={`w-1 flex-shrink-0 cursor-col-resize z-20 transition-colors duration-150 ${isDraggingLeft ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'}`}
          onMouseDown={makeResizeHandler(setLeftPaneWidth, true, 180, 0.4)}
        />
      )}

      {/* === メイン領域（エディタ ＋ レスポンス結果） === */}
      <div className={`flex flex-1 overflow-hidden ${layoutMode === 'vertical' ? 'flex-col' : 'flex-row'}`}>
        
        {/* === エディタペイン === */}
        <div className="flex-1 flex flex-col bg-white relative z-0 min-w-[200px] min-h-[150px]">
          {activeFile || isFreeMode ? (
            <>
              <div className="px-3 md:px-4 py-2 border-b border-gray-200 flex flex-wrap gap-x-4 gap-y-2 items-center justify-between bg-white shadow-sm z-10 relative">
                
                <div className="flex items-center min-w-[120px] flex-1 overflow-hidden">
                  <button 
                    onClick={() => setShowLeftPane(!showLeftPane)}
                    className={`p-1.5 mr-2 rounded transition-colors flex-shrink-0 ${!showLeftPane ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    title={showLeftPane ? "サイドバーを閉じる" : "サイドバーを開く"}
                  >
                    {showLeftPane ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                  </button>

                  {isFreeMode ? (
                    <span className="mr-2 p-1.5 rounded flex-shrink-0 bg-amber-50 text-amber-500"><Edit3 size={18} /></span>
                  ) : (
                    <span className={`mr-2 p-1.5 rounded flex-shrink-0 ${activeFile?.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600'}`}>
                      {activeFile?.type === 'pdf' ? <FileText size={18} /> : activeFile?.type === 'folder' ? <Folder size={18} /> : <File size={18} />}
                    </span>
                  )}
                  <h1 className="text-base font-bold text-gray-800 truncate" title={activeFile?.name}>{isFreeMode ? '自由記述' : activeFile?.name}</h1>
                </div>
                
                <div className="flex-shrink-0 flex items-center space-x-2">
                  
                  {/* === 保存ボタン (自由記述モード時のみ表示) === */}
                  {isFreeMode && (
                    <button 
                      onClick={() => setModal({ type: 'saveFreeText' })}
                      className="flex items-center py-1.5 px-3 rounded font-medium text-sm text-gray-700 bg-white border border-gray-300 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      <Save size={16} className="mr-1.5 text-gray-500" />
                      <span>保存</span>
                    </button>
                  )}

                  <button 
                    onClick={handleSend}
                    disabled={isSending || (activeFile?.type === 'folder' && !isFreeMode)}
                    className={`flex items-center py-1.5 px-3 rounded font-medium text-sm text-white shadow-sm transition-colors ${
                      isSending || (activeFile?.type === 'folder' && !isFreeMode) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                    }`}
                  >
                    {isSending ? (
                      <><Loader2 size={16} className="mr-1 animate-spin" /><span>送信中</span></>
                    ) : (
                      <><Send size={16} className="mr-1" /><span>送信</span></>
                    )}
                  </button>

                  <div className="w-px h-6 bg-gray-300"></div>

                  <div className="relative" ref={settingsRef}>
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className={`p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0 ${showSettings ? 'bg-gray-100' : ''}`}
                      title="設定"
                    >
                      <Settings size={18} />
                    </button>
                    {showSettings && (
                      <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                          <span className="font-semibold text-gray-700 text-sm">表示・動作設定</span>
                          <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                        </div>
                        <div className="p-4 border-b border-gray-100">
                          <span className="block text-xs font-semibold text-gray-500 mb-2">結果ペインのレイアウト</span>
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => { setLayoutMode('horizontal'); setShowResultPane(true); }}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                                layoutMode === 'horizontal' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <PanelRight size={14} className="mr-1.5 opacity-70" /> 左右分割
                            </button>
                            <button 
                              onClick={() => { setLayoutMode('vertical'); setShowResultPane(true); }}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                                layoutMode === 'vertical' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <PanelBottom size={14} className="mr-1.5 opacity-70" /> 上下分割
                            </button>
                          </div>
                        </div>
                        <div className="p-4">
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={autoExpand} 
                              onChange={(e) => setAutoExpand(e.target.checked)} 
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                              送信時に結果ペインを自動展開する
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setShowResultPane(!showResultPane)}
                    className={`p-1.5 rounded transition-colors flex-shrink-0 ${showResultPane ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    title={showResultPane ? "結果ペインを閉じる" : "結果ペインを開く"}
                  >
                    {layoutMode === 'horizontal' ? (
                      showResultPane ? <PanelRightClose size={18} /> : <PanelRight size={18} />
                    ) : (
                      showResultPane ? <PanelBottomClose size={18} /> : <PanelBottom size={18} />
                    )}
                  </button>
                </div>
              </div>

              <div className={`flex-1 flex flex-col p-4 overflow-hidden transition-colors ${isFreeMode ? 'bg-amber-50/30' : 'bg-gray-50'}`}>
                {activeFile?.type === 'folder' && !isFreeMode ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white border border-gray-200 rounded-sm">
                    <FolderOpen size={48} className="mb-4 text-blue-200" />
                    <p className="font-medium text-gray-500">フォルダが選択されています</p>
                    <p className="text-xs mt-2 text-gray-400">ファイルを選択するか、左上のボタンから追加してください。</p>
                  </div>
                ) : (
                  <div className={`flex-1 flex flex-col bg-white border shadow-inner rounded-sm overflow-hidden ${isFreeMode ? 'border-amber-200' : 'border-gray-300'}`}>
                    <textarea
                      value={contents[effectiveFileId] || ''}
                      onChange={handleContentChange}
                      className="flex-1 w-full p-4 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 leading-relaxed text-sm font-mono"
                      placeholder={isFreeMode ? "ここに自由にテキストを入力してください。" : "ファイルの内容をここで編集できます。"}
                      spellCheck="false"
                    />
                  </div>
                )}
                {!isFreeMode && activeFile?.type === 'pdf' && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center">
                    <AlertCircle size={14} className="mr-1 flex-shrink-0" />
                    <span className="truncate">PDFテキスト抽出モード（編集内容は送信時に反映されます）</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <File size={48} className="mb-4 opacity-50" />
              <p>ファイルを選択してください</p>
            </div>
          )}
        </div>

        {/* --- 結果ペイン リサイザー --- */}
        {showResultPane && layoutMode === 'horizontal' && (
          <div 
            className={`w-1 flex-shrink-0 cursor-col-resize z-20 transition-colors duration-150 ${isDraggingRight ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'}`}
            onMouseDown={startResizingRight}
          />
        )}
        {showResultPane && layoutMode === 'vertical' && (
          <div 
            className={`h-1 flex-shrink-0 cursor-row-resize z-20 transition-colors duration-150 ${isDraggingBottom ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'}`}
            onMouseDown={startResizingBottom}
          />
        )}

        {/* === 結果（レスポンス）ペイン === */}
        <div 
          className={`flex-shrink-0 bg-slate-50 flex flex-col z-10 shadow-sm overflow-hidden border-gray-300
            ${layoutMode === 'vertical' ? 'border-t' : ''}
            ${(!isDraggingLeft && !isDraggingRight && !isDraggingBottom) ? 'transition-[width,height] duration-300 ease-in-out' : ''}
          `}
          style={ layoutMode === 'horizontal' ? { width: showResultPane ? rightPaneWidth : 0 } : { height: showResultPane ? bottomPaneHeight : 0 } }
        >
          <div 
            className="flex flex-col" 
            style={ layoutMode === 'horizontal' 
              ? { width: rightPaneWidth, minWidth: rightPaneWidth, height: '100%' } 
              : { height: bottomPaneHeight, minHeight: bottomPaneHeight, width: '100%' } 
            }
          >
            <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-slate-100 flex-shrink-0">
              <div className="flex items-center">
                <GitMerge className="mr-2 text-slate-600" size={16} />
                <h2 className="font-semibold text-slate-700 text-sm">システムからの修正提案</h2>
              </div>
              <button onClick={() => setShowResultPane(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isSending ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
                  <p className="text-sm font-medium">テキストを分析し、修正案を作成中...</p>
                </div>
              ) : currentDiff ? (
                currentDiff.every(c => c.type === 'unchanged') ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-6">
                    <FileCheck size={32} className="mb-3 text-green-500" />
                    <p className="text-sm font-medium text-slate-600">修正の必要はありませんでした。</p>
                  </div>
                ) : (
                  <div className="font-mono text-sm leading-relaxed pb-10">
                    {currentDiff.map((chunk, chunkIdx) => {
                      if (chunk.type === 'unchanged') {
                        return (
                          <div key={chunkIdx} className="px-3 py-0.5 text-slate-400 opacity-70 whitespace-pre-wrap break-all">
                            <span className="inline-block w-4 mr-2"></span>{chunk.text}
                          </div>
                        );
                      } else {
                        return (
                          <div key={chunkIdx} className="my-4 bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm">
                            <div className="py-1">
                              {chunk.lines?.map((line, lineIdx) => (
                                <div 
                                  key={lineIdx} 
                                  className={`px-3 py-1 flex whitespace-pre-wrap break-all ${
                                    line.type === 'added' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
                                  }`}
                                >
                                  <span className={`select-none w-4 flex-shrink-0 font-bold ${
                                    line.type === 'added' ? 'text-green-500' : 'text-red-500'
                                  }`}>
                                    {line.type === 'added' ? '+' : '-'}
                                  </span>
                                  <span>{line.text || ' '}</span>
                                </div>
                              ))}
                            </div>
                            
                            <div className="bg-blue-50/60 border-t border-blue-100 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start text-xs text-blue-800">
                                <MessageSquare size={14} className="mr-2 mt-0.5 flex-shrink-0 text-blue-500" />
                                <span className="leading-snug">{chunk.reason}</span>
                              </div>
                              
                              <button 
                                onClick={() => handleApplySuggestion(chunk.id, chunk.originalText, chunk.suggestedText)}
                                disabled={chunk.applied}
                                className={`flex-shrink-0 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded transition-colors border shadow-sm ${
                                  chunk.applied 
                                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                                    : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50 active:bg-blue-100'
                                }`}
                              >
                                {chunk.applied ? (
                                  <><Check size={14} className="mr-1" /> 適用済み</>
                                ) : (
                                  <><CheckCircle size={14} className="mr-1" /> 修正を適用</>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-6">
                  <p className="text-sm text-center px-4 leading-relaxed">
                    「送信」ボタンを押すと、<br />
                    システムからの修正案がここに表示され、<br />
                    クリックで元文へ反映できます。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center bg-gray-800 text-white px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
          <CheckCircle size={20} className="text-green-400 mr-3" />
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}