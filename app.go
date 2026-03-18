package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// App struct
type App struct {
	ctx               context.Context
	currentDatasource string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		// 初期起動時のダミーデータソースパス
		currentDatasource: "C:/SampleProject",
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// ============================================================================
// フロントエンド (React) から呼び出されるメソッド群
// ============================================================================

// 1. 現在のデータソースのパスを取得する
func (a *App) GetDatasourcePath() string {
	fmt.Println("[Go] GetDatasourcePath called")
	return a.currentDatasource
}

// 2. 指定されたパス配下のファイルリストを取得する
func (a *App) GetFileList(path string) []string {
	fmt.Printf("[Go] GetFileList called: path='%s'\n", path)
	// TODO: 実際にOSのファイルシステムから path 配下のファイル一覧を取得する処理を実装
	// 以下は動作確認用のダミーデータです
	return []string{
		"プロジェクト資料/要件定義書.pdf",
		"プロジェクト資料/ミーティングメモ.txt",
		"README.txt",
	}
}

// 3. ファイルの内容を読み込む
func (a *App) ReadFile(path string) string {
	fmt.Printf("[Go] ReadFile called: path='%s'\n", path)
	// TODO: 実際にOSのファイルシステムから path のファイルを読み込む処理を実装
	// 以下は動作確認用のダミー処理です
	if strings.HasSuffix(path, "README.txt") {
		return "このツールはWails(Go+React)で動作させることを想定したGUIです。\n\n【追加機能】\n・初期化時にGoからパスリストを取得し、ツリーを構築します。\n・ファイルクリック時にGoのReadFile()を呼んで内容を取得します。"
	} else if strings.HasSuffix(path, ".pdf") {
		return "【要件定義書】\n\n1. 目的\n本システムは、社内のファイル共有を目的とする。\n\n2. 対象ユーザー\n全社員"
	}
	return "2026年3月17日 ミーティング\n\n- UIデザインの確認\n- 左側にファイルツリー\n- 右側にプレビュー\n- 送信機能について協議\n\n以上を確認します。"
}

// 4. 新しいデータソース（対象フォルダ）を設定する
func (a *App) SetNewDatasource(path string) bool {
	fmt.Printf("[Go] SetNewDatasource called: path='%s'\n", path)
	a.currentDatasource = path
	return true
}

// 5. フォルダを作成する
// parentId が無い(ルートへの作成)場合は空文字 ("") が送られてきます
func (a *App) CreateFolder(parentId string, name string) string {
	fmt.Printf("[Go] CreateFolder called: parentId='%s', name='%s'\n", parentId, name)
	// TODO: 実際のフォルダ作成処理を実装
	return fmt.Sprintf("folder-%d", time.Now().UnixMilli())
}

// 6. ノード(ファイル/フォルダ)を削除する
func (a *App) DeleteNode(id string) bool {
	fmt.Printf("[Go] DeleteNode called: id='%s'\n", id)
	// TODO: 実際のファイル/フォルダ削除処理を実装
	return true
}

// 7. アイテムを移動する (ドラッグ＆ドロップ)
func (a *App) MoveNode(itemId string, targetFolderId string) bool {
	fmt.Printf("[Go] MoveNode called: itemId='%s', targetFolderId='%s'\n", itemId, targetFolderId)
	// TODO: 実際の移動(リネーム)処理を実装
	return true
}

// 8. ファイルを保存(または新規アップロード)する
func (a *App) SaveFile(name string, content string, parentId string) string {
	fmt.Printf("[Go] SaveFile called: name='%s', parentId='%s'\n", name, parentId)
	// TODO: 実際のファイル書き込み処理を実装
	return fmt.Sprintf("file-%d", time.Now().UnixMilli())
}

// 9. テキストをAIなどで分析・修正する
func (a *App) AnalyzeText(text string) string {
	fmt.Println("[Go] AnalyzeText called")
	
	// TODO: 実際のAI API (OpenAI等) へのリクエスト処理を実装
	// 以下は動作確認用の単語置換（ダミーの修正提案）です
	suggested := text
	replacements := map[string]string{
		"目的とする。": "目的としています。",
		"全社員":    "全従業員（契約社員・アルバイト含む）",
		"協議":     "ディスカッション",
	}
	for target, rep := range replacements {
		if strings.Contains(suggested, target) {
			suggested = strings.ReplaceAll(suggested, target, rep)
		}
	}
	return suggested
}


