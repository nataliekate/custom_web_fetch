# Copilot Get Web Content Tool

A VS Code extension that adds a custom `#get_web_content` tool to GitHub Copilot Chat. It fetches a URL, extracts the readable text, and summarizes it using Copilot Chat's own language model — all without relying on the built-in `web_fetch` tool or Model Context Protocol (MCP) servers, which may be disabled by corporate policy.

---

## ✨ Features

- **`#get_web_content` tool** – Invoke it directly in Copilot Chat with a URL.
- **Automatic summarization** – Uses the same model that powers your Copilot Chat session (via the VS Code Language Model API).
- **Proxy-aware** – Respects VS Code's `http.proxy` setting and standard environment variables (`HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`).
- **SSL configuration** – Honors `http.proxyStrictSSL` for corporate proxies with self-signed certificates.
- **Readable text extraction** – Strips scripts, styles, navigation, footers, and other non-content elements using Cheerio.
- **Configurable** – Control proxy usage and maximum content length via settings.
- **No API keys required** – Leverages your existing GitHub Copilot subscription.

---

## 📋 Requirements

- **VS Code** 1.95.0 or higher
- **GitHub Copilot** and **GitHub Copilot Chat** extensions installed and signed in
- An active GitHub Copilot subscription (for model access)

---

## 📦 Installation

### From a VSIX package

1. Download the `.vsix` file.
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **Extensions: Install from VSIX...** and select the file.
4. Reload VS Code when prompted.

### From source

```bash
git clone <your-repo-url>
cd copilot-get-web-content
npm install
npm run compile
```

Then press `F5` to launch the Extension Development Host, or package it with `vsce package`.

---

## 🚀 Usage

Open GitHub Copilot Chat and use the tool in one of two ways:

### 1. Explicit invocation

```
#get_web_content https://en.wikipedia.org/wiki/Model_Context_Protocol
```

### 2. Let Copilot decide

```
Can you read and summarize this article for me? https://example.com/article
```

Copilot will automatically select `#get_web_content` when it detects a URL in your prompt.

### Example output

```
Summary of https://en.wikipedia.org/wiki/Model_Context_Protocol:

The Model Context Protocol (MCP) is an open standard introduced by Anthropic...
[3–6 paragraph summary follows]
```

---

## ⚙️ Configuration

All settings are under the **Get Web Content Tool** section in VS Code Settings (`Ctrl+,`).

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `getWebContent.useVSCodeProxy` | `boolean` | `true` | Use VS Code's `http.proxy` setting when fetching URLs. |
| `getWebContent.maxContentChars` | `number` | `12000` | Maximum number of characters to send to the model for summarization. |

### Example `settings.json`

```json
{
  "http.proxy": "http://proxy.corp.example.com:8080",
  "http.proxyStrictSSL": false,
  "getWebContent.useVSCodeProxy": true,
  "getWebContent.maxContentChars": 12000
}
```

---

## 🌐 Proxy Support

The tool resolves proxy configuration in the following order:

| Priority | Source | Setting / Env Var |
| :--- | :--- | :--- |
| 1 | VS Code setting | `http.proxy` (when `getWebContent.useVSCodeProxy` is `true`) |
| 2 | Environment | `HTTPS_PROXY` / `https_proxy` |
| 3 | Environment | `HTTP_PROXY` / `http_proxy` |
| 4 | Environment | `ALL_PROXY` / `all_proxy` |
| 5 | None | Direct connection |

### SSL verification

The `http.proxyStrictSSL` setting controls whether the proxy's SSL certificate is verified. Set it to `false` if your corporate proxy uses a self-signed certificate (common with Zscaler, Netskope, etc.):

```json
{
  "http.proxyStrictSSL": false
}
```

For a more secure approach, install your corporate root CA in your OS trust store instead.

### Proxy authentication

If your proxy requires authentication, embed credentials in the URL:

```json
{
  "http.proxy": "http://username:password@proxy.corp.example.com:8080"
}
```

> **Security note:** Storing credentials in plaintext settings is not recommended. Use environment variables or VS Code's SecretStorage in a production fork.

---

## 🧠 How It Works

1. **Fetch** – The tool receives a URL and fetches the page using `axios`, with proxy agents applied if configured.
2. **Extract** – Cheerio parses the HTML, removes non-content elements (`script`, `style`, `nav`, `footer`, etc.), and extracts the main readable text.
3. **Truncate** – The text is truncated to `getWebContent.maxContentChars` to fit within the model's context window.
4. **Summarize** – The text is sent to Copilot Chat's language model via `vscode.lm.selectChatModels({ vendor: 'copilot' })`. The first available model (which is the user's currently selected model in Copilot Chat) is used.
5. **Return** – The summary is returned to Copilot Chat as the tool result.

---

## 🛠️ Development

### Build

```bash
npm install
npm run compile
```

### Watch mode

```bash
npm run watch
```

### Debug

Press `F5` in VS Code to launch the Extension Development Host. The extension will activate automatically.

### Project structure

```
.
├── src/
│   ├── extension.ts          # Activation and tool registration
│   └── tools/
│       ├── getWebContent.ts  # Tool implementation
│       └── proxyConfig.ts    # Proxy resolution helpers
├── package.json              # Tool declaration and dependencies
├── tsconfig.json
└── README.md
```

---

## 🐛 Troubleshooting

### "Failed to fetch URL: HTTP 407"

Your proxy requires authentication. Add credentials to the `http.proxy` URL or set them via environment variables.

### "Failed to fetch URL: self signed certificate in certificate chain"

Your corporate proxy uses a self-signed certificate. Set `http.proxyStrictSSL` to `false`, or install the corporate root CA.

### "No model available" / raw content returned

Copilot Chat's model could not be selected. Ensure:
- GitHub Copilot and Copilot Chat extensions are installed and signed in.
- You have an active Copilot subscription.
- VS Code is version 1.95 or higher.

### Empty or minimal content extracted

Some sites render content dynamically with JavaScript. This tool uses static HTML parsing via Cheerio and may not capture content from single-page applications (SPAs). For those cases, consider a headless browser approach (e.g., Playwright) in a custom fork.

### Tool not appearing in Copilot Chat

- Ensure the extension is activated (check the Extension Host log).
- Reload VS Code after installation.
- Verify that `#get_web_content` appears in the tool picker when typing `#` in Copilot Chat.

---

## 🔒 Security & Corporate Policy

- This extension makes **outbound HTTP requests** from the VS Code extension host process using `axios`. It does **not** use the built-in `web_fetch` tool or MCP servers.
- If your organization restricts outbound traffic, configure an approved corporate proxy via `http.proxy` or environment variables.
- The extension logs the URLs it fetches to the Extension Host output for debugging. If URL logging is sensitive in your environment, remove or redact the `console.log` statements in `getWebContent.ts` and `proxyConfig.ts`.
- Always review your organization's acceptable use policy before installing or using this extension.

---

## 📄 License

MIT

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## 🙏 Acknowledgements

- [Cheerio](https://github.com/cheeriojs/cheerio) for HTML parsing
- [Axios](https://github.com/axios/axios) for HTTP requests
- [https-proxy-agent](https://github.com/TooTallNate/proxy-agents) and [http-proxy-agent](https://github.com/TooTallNate/proxy-agents) for proxy support
- The VS Code team for the Language Model API