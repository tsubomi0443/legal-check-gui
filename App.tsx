import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  File, 
  Send, 
  Upload, 
  ChevronRight, 
  ChevronDown,
  CheckCircle,
  Loader2,
  AlertCircle,
  GitMerge,
  MessageSquare,
  FileCheck,
  PanelRightClose,
  PanelRight,
  PanelBottomClose,
  PanelBottom,
  PanelLeftClose,
  PanelLeft,
  Settings,
  X,
  Check,
  Edit3
} from 'lucide-react';

// --- 型定義 (TypeScript) ---
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

// --- モックデータ ---
const initialFiles: FileNode[] = [
  { 
    id: 'folder-1', 
    name: 'プロジェクト資料', 
    type: 'folder', 
    isOpen: true, 
    children: [
      { id: 'file-1', name: '要件定義書.pdf', type: 'pdf' },
      { id: 'file-2', name: 'ミーティングメモ.txt', type: 'txt' },
    ]
  },
  { id: 'file-3', name: 'README.txt', type: 'txt' }
];

const initialContents: Record<string, string> = {
  'file-1': '【要件定義書】\n\n1. 目的\n本システムは、社内のファイル共有を目的とする。\n\n2. 対象ユーザー\n全社員\n\n（※PDFから抽出されたテキストのプレビューです。）',
  'file-2': '2026年3月17日 ミーティング\n\n- UIデザインの確認\n- 左側にファイルツリー\n- 右側にプレビュー\n- 送信機能について協議\n\n以上を確認します。',
  'file-3': 'このツールはテキストやPDFを選択・編集し、送信するGUIツールです。\n\n・左側のエクスプローラからファイルを選択します。\n・中央のエディタで内容を書き換えます。\n・「送信」ボタンで変更内容を送信し、結果を確認します。\n\n左右のペイン境界線をドラッグして、中央ペインの幅を狭くしてみてください。\nヘッダーのボタンが折り返されて常に表示されることを確認できます。',
  'free-mode': 'ここは自由記述モードです。\n\n自由にテキストを入力し、「送信する」ボタンを押すと、\nシステムからの修正提案を受けることができます。\n\n例：この文章の目的とする。'
};

// --- AIによる修正提案のモック処理 ---
const simulateReview = (text: string): string => {
  let newText = text;
  const replacements = [
    { target: '目的とする。', replacement: '目的としています。' },
    { target: '全社員', replacement: '全従業員（契約社員・アルバイト含む）' },
    { target: '協議', replacement: 'ディスカッション' },
    { target: '確認します。', replacement: '確認できます。' },
    { target: '送信するGUIツールです。', replacement: '安全に送信するためのGUIツールです。' },
    { target: 'ファイル', replacement: 'ドキュメント' },
    { target: 'テキストやPDF', replacement: '各種ドキュメント（テキスト、PDF等）' }
  ];

  let changedCount = 0;
  replacements.forEach(({target, replacement}) => {
    if (newText.includes(target)) {
      newText = newText.replace(target, replacement);
      changedCount++;
    }
  });

  if (changedCount === 0) {
    if (newText.trim().length > 0) {
      newText += '\n\n【システム追記】文章のフォーマットは適切です。';
    } else {
      newText = '【システム追記】テキストが空です。内容を記述してください。';
    }
  }

  return newText;
};

// --- 簡易的なLCSによるDiff計算 ---
const calculateDiff = (oldStr: string, newStr: string): DiffLine[] => {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const dp: number[][] = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
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
  
  const reasons = [
    "表現をより明確にするため、簡潔な言い回しに修正しました。",
    "ビジネスシーンに適した、より丁寧な語彙に置き換えました。",
    "情報の抜け漏れを防ぐため、詳細な説明を補足しました。"
  ];

  const flushDiff = () => {
    if (currentDiffLines.length > 0) {
      const origText = currentDiffLines.filter(l => l.type === 'removed').map(l => l.text).join('\n');
      const suggText = currentDiffLines.filter(l => l.type === 'added').map(l => l.text).join('\n');
      
      chunks.push({ 
        id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'diff', 
        lines: currentDiffLines,
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        originalText: origText,
        suggestedText: suggText,
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
  const [diffResults, setDiffResults] = useState<Record<string, DiffChunk[] | null>>({});
  const [toast, setToast] = useState<ToastType | null>(null);
  
  // --- モード切替 ---
  const [isFreeMode, setIsFreeMode] = useState<boolean>(false);

  // --- UI表示・設定のステート ---
  const [showLeftPane, setShowLeftPane] = useState<boolean>(true);
  const [showResultPane, setShowResultPane] = useState<boolean>(false);
  const [autoExpand, setAutoExpand] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');

  // --- ペイン幅・高さのリサイズ用ステート ---
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(260);
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(450);
  const [bottomPaneHeight, setBottomPaneHeight] = useState<number>(300);
  
  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);
  const [isDraggingBottom, setIsDraggingBottom] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const effectiveFileId = isFreeMode ? 'free-mode' : selectedFileId;

  // --- リサイズハンドラ ---
  const startResizingLeft = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    const startX = e.clientX;
    const startWidth = leftPaneWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(window.innerWidth * 0.4, startWidth + moveEvent.clientX - startX));
      setLeftPaneWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsDraggingLeft(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingRight = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRight(true);
    const startX = e.clientX;
    const startWidth = rightPaneWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(250, Math.min(window.innerWidth * 0.5, startWidth - (moveEvent.clientX - startX)));
      setRightPaneWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsDraggingRight(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingBottom = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingBottom(true);
    const startY = e.clientY;
    const startHeight = bottomPaneHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = Math.max(150, Math.min(window.innerHeight * 0.7, startHeight - (moveEvent.clientY - startY)));
      setBottomPaneHeight(newHeight);
    };
    const onMouseUp = () => {
      setIsDraggingBottom(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // --- ファイルツリー操作 ---
  const toggleFolder = (folderId: string, currentFiles: FileNode[]): FileNode[] => {
    return currentFiles.map(node => {
      if (node.id === folderId && node.type === 'folder') {
        return { ...node, isOpen: !node.isOpen };
      }
      if (node.children) {
        return { ...node, children: toggleFolder(folderId, node.children) };
      }
      return node;
    });
  };

  const handleToggleFolder = (e: React.MouseEvent<HTMLDivElement>, folderId: string) => {
    e.stopPropagation();
    setFiles(prev => toggleFolder(folderId, prev));
  };

  const handleSelectFile = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContents({
      ...contents,
      [effectiveFileId]: e.target.value
    });
    setDiffResults(prev => ({ ...prev, [effectiveFileId]: null }));
    setShowResultPane(false);
  };

  // --- 送信 ---
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

      if (autoExpand) {
        setShowResultPane(true);
      }
      
      showToast('修正案を受信しました', 'success');
    }, 1500);
  };

  // --- 提案適用 ---
  const handleApplySuggestion = (chunkId?: string, originalText?: string, suggestedText?: string) => {
    if (!chunkId || !suggestedText) return;

    setContents(prev => {
      const currentText = prev[effectiveFileId] || '';
      let newText = currentText;
      if (originalText) {
         newText = currentText.replace(originalText, suggestedText);
      } else {
         newText = currentText + '\n' + suggestedText;
      }
      return { ...prev, [effectiveFileId]: newText };
    });

    setDiffResults(prev => {
      const currentDiffs = prev[effectiveFileId];
      if (!currentDiffs) return prev;
      const newDiffs = currentDiffs.map(c => 
        c.id === chunkId ? { ...c, applied: true } : c
      );
      return { ...prev, [effectiveFileId]: newDiffs };
    });
    
    showToast('提案内容を元文へ適用しました', 'success');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- ファイルアップロード ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const uploadedFile = e.target.files[0];
    const newId = `uploaded-${Date.now()}`;
    const isPdf = uploadedFile.name.toLowerCase().endsWith('.pdf');
    const newFileNode: FileNode = { id: newId, name: uploadedFile.name, type: isPdf ? 'pdf' : 'txt' };

    const processFile = (text: string) => {
      setFiles([...files, newFileNode]);
      setContents({ ...contents, [newId]: text });
      setSelectedFileId(newId);
    };

    if (isPdf) {
      processFile(`[${uploadedFile.name} のテキスト抽出プレビュー]\n\n※PDFの内容をここに表示します。`);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => processFile(event.target?.result as string);
      reader.readAsText(uploadedFile);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getSelectedFile = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = getSelectedFile(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeFile = isFreeMode 
    ? { id: 'free-mode', name: '自由記述（ファイル未指定）', type: 'txt' as FileType }
    : getSelectedFile(files, selectedFileId);
  
  const currentDiff = diffResults[effectiveFileId];

  const renderTree = (nodes: FileNode[], depth: number = 0): React.ReactNode => {
    return nodes.map(node => {
      const isSelected = selectedFileId === node.id;
      if (node.type === 'folder') {
        return (
          <div key={node.id}>
            <div 
              className="flex items-center py-1.5 px-2 cursor-pointer hover:bg-gray-200 text-gray-700 text-sm"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={(e) => handleToggleFolder(e, node.id)}
            >
              <span className="mr-1 text-gray-500">{node.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              <span className="mr-2 text-blue-500">{node.isOpen ? <FolderOpen size={16} /> : <Folder size={16} />}</span>
              <span className="truncate select-none">{node.name}</span>
            </div>
            {node.isOpen && node.children && <div>{renderTree(node.children, depth + 1)}</div>}
          </div>
        );
      }
      return (
        <div 
          key={node.id}
          className={`flex items-center py-1.5 px-2 cursor-pointer text-sm ${isSelected ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-700'}`}
          style={{ paddingLeft: `${depth * 16 + 28}px` }}
          onClick={() => handleSelectFile(node.id)}
        >
          <span className={`mr-2 ${node.type === 'pdf' ? 'text-red-500' : 'text-gray-500'}`}>
            {node.type === 'pdf' ? <FileText size={16} /> : <File size={16} />}
          </span>
          <span className="truncate select-none">{node.name}</span>
        </div>
      );
    });
  };

  return (
    <div 
      className={`flex h-screen bg-gray-100 text-gray-800 font-sans overflow-hidden ${
        (isDraggingLeft || isDraggingRight) ? 'select-none cursor-col-resize' : 
        isDraggingBottom ? 'select-none cursor-row-resize' : ''
      }`}
    >
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
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
              <div className="p-2.5 border-b border-gray-200">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.pdf,.csv,.md" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center py-1.5 px-3 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Upload size={14} className="mr-2" />
                  <span className="truncate">ファイルを追加</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {renderTree(files)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- 左ペイン リサイザー --- */}
      {showLeftPane && (
        <div 
          className={`w-1 flex-shrink-0 cursor-col-resize z-20 transition-colors duration-150 ${isDraggingLeft ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'}`}
          onMouseDown={startResizingLeft}
        />
      )}

      {/* === メイン領域（エディタ ＋ レスポンス結果） === */}
      <div className={`flex flex-1 overflow-hidden ${layoutMode === 'vertical' ? 'flex-col' : 'flex-row'}`}>
        
        {/* === エディタペイン === */}
        <div className="flex-1 flex flex-col bg-white relative z-0 min-w-[200px] min-h-[150px]">
          {activeFile ? (
            <>
              {/* ヘッダー部：幅が狭い時に折り返すように flex-wrap を設定 */}
              <div className="px-3 md:px-4 py-2 border-b border-gray-200 flex flex-wrap gap-x-4 gap-y-2 items-center justify-between bg-white shadow-sm z-10 relative">
                
                {/* 左側グループ (ファイル名など) */}
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
                    <span className={`mr-2 p-1.5 rounded flex-shrink-0 ${activeFile.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600'}`}>
                      {activeFile.type === 'pdf' ? <FileText size={18} /> : <File size={18} />}
                    </span>
                  )}
                  <h1 className="text-base font-bold text-gray-800 truncate" title={activeFile.name}>{activeFile.name}</h1>
                </div>
                
                {/* 右側グループ (アクションボタン群) */}
                <div className="flex-shrink-0 flex items-center space-x-2">
                  <button 
                    onClick={handleSend}
                    disabled={isSending}
                    className={`flex items-center py-1.5 px-3 rounded font-medium text-sm text-white shadow-sm transition-colors ${
                      isSending ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
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

                  {/* 結果ペイン表示トグル */}
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

              {/* エディタ本文 */}
              <div className={`flex-1 flex flex-col p-4 overflow-hidden transition-colors ${isFreeMode ? 'bg-amber-50/30' : 'bg-gray-50'}`}>
                <div className={`flex-1 flex flex-col bg-white border shadow-inner rounded-sm overflow-hidden ${isFreeMode ? 'border-amber-200' : 'border-gray-300'}`}>
                  <textarea
                    value={contents[effectiveFileId] || ''}
                    onChange={handleContentChange}
                    className="flex-1 w-full p-4 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 leading-relaxed text-sm font-mono"
                    placeholder={isFreeMode ? "ここに自由にテキストを入力してください。" : "ファイルの内容をここで編集できます。"}
                    spellCheck="false"
                  />
                </div>
                {!isFreeMode && activeFile.type === 'pdf' && (
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

        {/* --- 結果ペイン リサイザー (モードに応じて左右 or 上下) --- */}
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
                              {chunk.lines.map((line, lineIdx) => (
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

      {/* --- トースト通知 --- */}
      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center bg-gray-800 text-white px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
          <CheckCircle size={20} className="text-green-400 mr-3" />
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
      `}} />
    </div>
  );
}