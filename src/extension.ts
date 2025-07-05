import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let urls: string[] = context.globalState.get('urls', []);
	const didChangeEmitter = new vscode.EventEmitter<void>();

	/**
	 * You can use proposed API here. `vscode.` should start auto complete
	 * Proposed API as defined in vscode.proposed.<proposalName>.d.ts.
	 */

	// Register tree data provider for the view
	const treeDataProvider = new McpTreeDataProvider(urls, didChangeEmitter);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('mcpExtensionSampleView', treeDataProvider));


	context.subscriptions.push(vscode.commands.registerCommand('mcp-extension-sample.addGist', async () => {
		const url = await vscode.window.showInputBox({ prompt: 'Enter URL (Gist or other)' });
		if (url) {
			urls.push(url);
			context.globalState.update('urls', urls);
			vscode.window.showInformationMessage(`URL added: ${url}`);
			treeDataProvider.updateUrls(urls);
			didChangeEmitter.fire();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mcp-extension-sample.removeGist', async () => {
		const url = await vscode.window.showQuickPick(urls, { placeHolder: 'Select URL to remove' });
		if (url) {
			urls = urls.filter(u => u !== url);
			context.globalState.update('urls', urls);
			vscode.window.showInformationMessage(`URL removed: ${url}`);
			treeDataProvider.updateUrls(urls);
			didChangeEmitter.fire();
		}
	}));

	context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider('exampleGist', {
		onDidChangeMcpServerDefinitions: didChangeEmitter.event,
		provideMcpServerDefinitions: async () => {
			let output: vscode.McpServerDefinition[] = [];
			await Promise.all(urls.map(url => fetchMcpContents(url).then(content => {
				const s = JSON.parse(content);
				if (!Array.isArray(s)) {
					throw new Error(`Content is not an MCP server array: ${url}`);
				}

				for (const server of s) {
					if (server.type === 'http' || server.type === 'sse') {
						// HTTP/SSEサーバー定義
						output.push(new vscode.McpHttpServerDefinition(
							server.label,
							vscode.Uri.parse(server.uri),
							server.headers || {},
							server.version
						));
					} else {
						// Stdioサーバー定義（従来通り）
						output.push(new vscode.McpStdioServerDefinition(
							server.label,
							server.command,
							server.args,
							server.env,
							server.version
						));
					}
				}
			})));

			return output;
		}
	}));
}

async function fetchMcpContents(url: string): Promise<string> {
	// Check if it's a gist URL
	const gistId = extractGistId(url);
	if (gistId) {
		return fetchGistContents(gistId);
	}

	// For non-gist URLs, fetch directly
	try {
		const response = await fetch(url);
		
		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
		}

		return await response.text();
	} catch (error) {
		console.error('Error fetching URL:', error);
		throw error;
	}
}

async function fetchGistContents(gistId: string): Promise<string> {
	// Fetch the raw gist content
	try {
		const response = await fetch(`https://api.github.com/gists/${gistId}`);

		if (!response.ok) {
			throw new Error(`Failed to fetch gist: ${response.status} ${response.statusText}`);
		}

		const gistData: any = await response.json();

		// Get the first file content from the gist
		const files = gistData.files;
		const firstFile = Object.keys(files)[0];

		if (files[firstFile].truncated) {
			// If content is truncated, fetch the raw URL
			const rawResponse = await fetch(files[firstFile].raw_url);
			if (!rawResponse.ok) {
				throw new Error(`Failed to fetch raw content: ${rawResponse.status}`);
			}
			return await rawResponse.text();
		} else {
			return files[firstFile].content;
		}
	} catch (error) {
		console.error('Error fetching gist:', error);
		throw error;
	}
}

// Helper function to extract gist ID from URL
function extractGistId(url: string): string | null {
	// Handle URLs like https://gist.github.com/user/gistId or just the ID
	const match = url.match(/gist\.github\.com\/(?:[^/]+\/)?([a-zA-Z0-9]+)/) || url.match(/^([a-zA-Z0-9]+)$/);
	return match ? match[1] : null;
}

interface McpTreeItem {
	type: 'url' | 'server' | 'message';
	label: string;
	url?: string;
	serverInfo?: any;
}

class McpTreeDataProvider implements vscode.TreeDataProvider<McpTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<McpTreeItem | undefined | null | void> = new vscode.EventEmitter<McpTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<McpTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
	private serverInfoCache: Map<string, any[]> = new Map();

	constructor(private urls: string[], didChangeEmitter: vscode.EventEmitter<void>) {
		didChangeEmitter.event(() => {
			this._onDidChangeTreeData.fire();
		});
	}

	updateUrls(urls: string[]): void {
		this.urls = urls;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: McpTreeItem): vscode.TreeItem {
		let item: vscode.TreeItem;
		
		if (element.type === 'url') {
			item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
			item.tooltip = element.url;
			item.iconPath = new vscode.ThemeIcon('globe');
		} else if (element.type === 'server') {
			item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
			item.tooltip = `Type: ${element.serverInfo?.type || 'unknown'}\nLabel: ${element.serverInfo?.label || 'unknown'}`;
			item.iconPath = new vscode.ThemeIcon('server');
		} else {
			item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
			item.iconPath = new vscode.ThemeIcon('info');
		}
		
		return item;
	}

	async getChildren(element?: McpTreeItem): Promise<McpTreeItem[]> {
		if (!element) {
			if (this.urls.length === 0) {
				return [{ type: 'message', label: 'MCP URLが設定されていません' }];
			}
			return this.urls.map(url => ({ type: 'url', label: url, url }));
		}
		
		if (element.type === 'url' && element.url) {
			try {
				const servers = await this.fetchServerInfo(element.url);
				return servers.map(server => ({
					type: 'server',
					label: server.label || 'Unknown Server',
					serverInfo: server
				}));
			} catch (error) {
				return [{ type: 'message', label: `エラー: ${error instanceof Error ? error.message : 'Unknown error'}` }];
			}
		}
		
		return [];
	}

	private async fetchServerInfo(url: string): Promise<any[]> {
		if (this.serverInfoCache.has(url)) {
			return this.serverInfoCache.get(url) || [];
		}

		try {
			const content = await fetchMcpContents(url);
			const servers = JSON.parse(content);
			
			if (!Array.isArray(servers)) {
				console.error('Content is not an MCP server array:', content);
				throw new Error('Content is not an MCP server array');
			}
			
			this.serverInfoCache.set(url, servers);
			return servers;
		} catch (error) {
			throw error;
		}
	}
}