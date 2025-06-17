# MCP Extension Sample

VS Code拡張機能のサンプルプロジェクトです。MCP (Model Context Protocol) サーバー定義プロバイダーとしてGitHub Gistからサーバー定義を動的に読み込む機能を提供します。

## 概要

この拡張機能は、GitHub GistからMCPサーバーの定義を動的に読み込み、VS Codeで利用できるようにします。Proposed APIを使用してMCPサーバー定義プロバイダーを実装しています。

## 機能

- **Add Gist Source**: GitHub GistのURLを追加してMCPサーバー定義を読み込む
- **Remove Gist Source**: 登録されたGistを削除する
- **動的サーバー定義**: GistからJSON形式のMCPサーバー定義を自動で読み込み

## 必要要件

- Visual Studio Code 1.101.0以上
- TypeScript 5.8.2以上
- Node.js 20以上

## インストール・セットアップ

1. リポジトリをクローンします：
   ```bash
   git clone https://github.com/Microsoft/vscode-extension-samples
   cd mcp-extension-sample
   ```

2. 依存関係をインストールします：
   ```bash
   npm install
   ```

3. TypeScriptをコンパイルします：
   ```bash
   npm run compile
   ```

4. VS Codeでプロジェクトを開き、F5キーを押してExtension Development Hostを起動します。

## 使用方法

### Gistの追加

1. コマンドパレット (`Cmd+Shift+P`) を開く
2. "MCP Extension Sample: Add Gist Source" を選択
3. GitHub GistのURLを入力

### Gistの削除

1. コマンドパレット (`Cmd+Shift+P`) を開く
2. "MCP Extension Sample: Remove Gist Source" を選択
3. 削除したいGistを選択

### GistのJSON形式

Gistに保存するMCPサーバー定義は以下の形式で記述してください：

```json
[
  {
    "label": "サーバー名",
    "command": "実行コマンド",
    "args": ["引数1", "引数2"],
    "env": {
      "環境変数名": "値"
    }
  }
]
```

## 開発

### スクリプト

- `npm run compile`: TypeScriptをコンパイル
- `npm run watch`: ファイル変更を監視してコンパイル
- `npm run vscode:prepublish`: 公開前のビルド

### プロジェクト構造

```
├── src/
│   └── extension.ts      # メイン拡張機能コード
├── package.json          # 拡張機能の設定とメタデータ
├── tsconfig.json         # TypeScript設定
├── vscode.d.ts          # VS Code型定義
└── README.md            # このファイル
```

## 実装の詳細

### MCP Server Definition Provider

`vscode.lm.registerMcpServerDefinitionProvider` を使用してMCPサーバー定義プロバイダーを登録しています。プロバイダーは以下の機能を提供します：

- GitHub GistからJSON形式のサーバー定義を取得
- 複数のGistからの定義をマージ
- 定義の変更を監視して動的に更新

### データの永続化

`vscode.ExtensionContext.globalState` を使用してGistのURLリストを永続化しています。

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。

## 参考リンク

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [VS Code Extension Samples](https://github.com/Microsoft/vscode-extension-samples)
