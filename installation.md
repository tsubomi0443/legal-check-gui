File Sender GUI ローカル起動手順

このプロジェクトは、Vite + React + TypeScript + Tailwind CSS で構築されています。

前提条件

Node.js がインストールされていること（推奨: v18以上）

セットアップ手順

プロジェクトの作成（まだ作成していない場合）
任意のディレクトリで以下のコマンドを実行し、ViteのReact/TypeScriptテンプレートを作成します。

npm create vite@latest file-sender-gui -- --template react-ts
cd file-sender-gui


必要なパッケージのインストール
アイコンライブラリ（lucide-react）と、Tailwind CSSをインストールします。

npm install lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p


設定ファイルの置き換え

生成された tailwind.config.js の内容を、提供されたものに書き換えます。

src/index.css の中身をすべて消し、提供された Tailwind のディレクティブ（@tailwind base; 等）に書き換えます。

先ほど作成した App.tsx のコードをコピーし、src/App.tsx の中身と完全に差し替えます。

開発サーバーの起動
以下のコマンドを実行します。

npm run dev


ブラウザで確認
コンソールに表示されたローカルURL（例: http://localhost:5173/）にアクセスすると、アプリが起動します。