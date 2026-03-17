package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// 1. フォルダ作成
// parentId が無い場合は空文字 ("") が送られてきます
func (a *App) CreateFolder(parentId string, name string) string {
	fmt.Printf("[Go] CreateFolder called: parentId='%s', name='%s'\n", parentId, name)
	// 本来のフォルダ作成処理をここに書く
	return fmt.Sprintf("folder-%d", time.Now().UnixMilli())
}

// 2. ノード(ファイル/フォルダ)削除
func (a *App) DeleteNode(id string) bool {
	fmt.Printf("[Go] DeleteNode called: id='%s'\n", id)
	return true
}

// 3. 移動 (ドラッグ＆ドロップ)
func (a *App) MoveNode(itemId string, targetFolderId string) bool {
	fmt.Printf("[Go] MoveNode called: itemId='%s', targetFolderId='%s'\n", itemId, targetFolderId)
	return true
}

// 4. ファイル保存/追加
func (a *App) SaveFile(name string, content string, parentId string) string {
	fmt.Printf("[Go] SaveFile called: name='%s', parentId='%s'\n", name, parentId)
	// 本来のファイル保存処理をここに書く
	return fmt.Sprintf("file-%d", time.Now().UnixMilli())
}

// 5. テキスト分析 (送信ボタン)
func (a *App) AnalyzeText(text string) string {
	fmt.Println("[Go] AnalyzeText called")
	
	// ここにAI API等への通信処理を書く
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


