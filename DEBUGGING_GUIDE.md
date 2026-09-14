# Debugging Guide

This document explains how to debug the **Copilot Get Web Content Tool** extension in VS Code, from initial setup to advanced scenarios like attaching to a running Extension Host.

---

## 📁 Required Files

Add a `.vscode/` folder to the root of the project:

```
.
├── .vscode/
│   ├── launch.json
│   └── tasks.json
├── src/
│   ├── extension.ts
│   └── tools/
│       ├── getWebContent.ts
│       └── proxyConfig.ts
├── package.json
├── tsconfig.json
├── README.md
└── DEBUGGING.md      ← this file
```

---

## 1. Build Task — `.vscode/tasks.json`

Compiles TypeScript before launching the debugger and keeps rebuilding on changes.

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
      "presentation": {
        "reveal": "never",
        "group": "build"
      },
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "label": "npm: watch"
    }
  ]
}
```

> **Why `watch` and not `compile`?** Watch mode keeps the TypeScript compiler running so every source change is rebuilt automatically. When you edit a file, reload the Extension Development Host with `Ctrl+R` / `Cmd+R` — no manual recompile needed.

---

## 2. Launch Configuration — `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: watch",
      "sourceMaps": true,
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ]
    },
    {
      "name": "Run Extension (no prelaunch)",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "sourceMaps": true
    },
    {
      "name": "Attach to Extension Host",
      "type": "extensionHost",
      "request": "attach",
      "port": 5870,
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "sourceMaps": true
    }
  ]
}
```

### Field Breakdown

| Field                       | Purpose                                                        |
| :-------------------------- | :------------------------------------------------------------- |
| `type: "extensionHost"`     | Launches a second VS Code instance with your extension loaded. |
| `args`                      | Points the new window at your extension folder.                |
| `outFiles`                  | Where compiled JS lives — required for source-map mapping.     |
| `preLaunchTask`             | Runs the `npm: watch` task first so `out/` is populated.       |
| `sourceMaps: true`          | Lets you set breakpoints in `.ts` files, not compiled `.js`.   |
| `resolveSourceMapLocations` | Prevents the debugger from stopping inside `node_modules`.     |

---

## 3. Basic Debugging Workflow

1. **Open the extension project** in VS Code (the folder containing `src/`).
2. **Set breakpoints** in `src/tools/getWebContent.ts` — for example, on the line:
   ```typescript
   const response = await axios.get(url, axiosConfig);
   ```
3. Press **F5** (or **Run → Start Debugging**).
4. A new window titled **"Extension Development Host"** opens. This is a fresh VS Code instance with your extension loaded.
5. In that window, open **Copilot Chat** and run:
   ```
   #get_web_content https://example.com
   ```
6. Execution hits your breakpoint **in the original window**. You can then:
   - Inspect `url`, `axiosConfig`, `response`, `textContent`, etc.
   - Step over (`F10`), step into (`F11`), continue (`F5`).
   - View the **Call Stack**, **Variables**, and **Watch** panels.

> **Important:** Breakpoints only fire inside the _debuggee_ process. The `invoke()` method runs in the Extension Development Host, so make sure you are watching the correct window's call stack.

---

## 4. Testing the Tool Without Copilot Chat

Because `#get_web_content` is invoked by Copilot Chat (not directly by user code), here is a reliable way to test it **without going through Chat every time**. Add a temporary command to your extension:

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { GetWebContentTool } from './tools/getWebContent';

export function activate(context: vscode.ExtensionContext) {
  const tool = new GetWebContentTool();

  context.subscriptions.push(vscode.lm.registerTool('get_web_content', tool));

  // 👇 Temporary debug command — remove before publishing.
  context.subscriptions.push(
    vscode.commands.registerCommand('getWebContent.debug', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'URL to fetch and summarize',
        value: 'https://en.wikipedia.org/wiki/Model_Context_Protocol',
      });
      if (!url) {
        return;
      }

      const result = await tool.invoke(
        { input: { url }, toolInvocationToken: undefined } as any,
        new vscode.CancellationTokenSource().token,
      );

      const text = (result.content[0] as vscode.LanguageModelTextPart).value;
      const doc = await vscode.workspace.openTextDocument({
        content: text,
        language: 'markdown',
      });
      vscode.window.showTextDocument(doc);
    }),
  );

  console.log('Copilot Get Web Content Tool activated.');
}

export function deactivate() {}
```

Then in the Extension Development Host, press `Ctrl+Shift+P` and run:

```
> Get Web Content: Debug
```

This gives you a **deterministic test path** that doesn't depend on Copilot's model picking the right tool — perfect for breakpoints.

---

## 5. When Breakpoints Won't Bind

If breakpoints appear grey or unbound, check the following:

- **`sourceMap: true` is set in `tsconfig.json`.**
- **`outFiles` matches the output path** — `out/**/*.js`.
- **The build actually ran** — look for `.js.map` files in `out/`.
- **You're debugging the right window** — the Extension Development Host, not the original one.

To force a clean rebuild:

```bash
rm -rf out
npm run compile
```

---

## 6. Debugging Proxy Resolution

The proxy helper logs the resolved proxy to the console. To see these logs:

1. In the Extension Development Host, open the **Output** panel (`Ctrl+Shift+U` / `Cmd+Shift+U`).
2. Select **"Extension Host"** from the dropdown.
3. Look for lines like:
   ```
   [get_web_content] Fetching https://... . Proxy (vscode-setting): http://proxy.corp.example.com:8080
   [get_web_content] Summarizing with copilot/gpt-4o (id=..., maxInputTokens=...)
   ```

To test proxy resolution in isolation, set a breakpoint in `src/tools/proxyConfig.ts`:

```typescript
export function resolveProxy(): ProxyInfo {
    // 👇 set a breakpoint here
    const useVSCodeProxy = vscode.workspace
        .getConfiguration('getWebContent')
        .get<boolean>('useVSCodeProxy', true);
    ...
}
```

Then inspect `process.env` and the resolved `vscode.workspace.getConfiguration('http')` object.

---

## 7. Attaching to a Running Extension Host

If you launch the Extension Development Host manually (e.g., via a script) and want to attach the debugger later:

1. Select the **"Attach to Extension Host"** configuration from the Run and Debug panel.
2. Start the host with the debug port open:

   ```bash
   code --extensionDevelopmentPath=${PWD} --inspect-extensions=5870
   ```

3. Press **F5** to attach.

---

## 8. Logging vs. Breakpoints

For **async/await chains** (like `axios.get` followed by `summarizeWithCopilot`), breakpoints can be finicky if the process is fast. Two strategies:

- **Use `debugger;` statements** in the source — they behave exactly like breakpoints but are baked into the code:
  ```typescript
  const response = await axios.get(url, axiosConfig);
  debugger; // ← execution pauses here
  ```
- **Add granular `console.log` calls** and watch the Output panel — often faster than stepping through.

---

## 9. Common Debugging Pitfalls

| Symptom                                     | Fix                                                                                             |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------- |
| Breakpoints are grey / "unbound"            | Ensure `out/*.js.map` files exist and `sourceMaps: true` is set.                                |
| Debugger doesn't stop inside `invoke()`     | Make sure you're debugging the **Extension Development Host** window, not the workspace window. |
| `vscode.lm.selectChatModels` returns `[]`   | Sign into Copilot in the **Extension Development Host** window too — it has its own session.    |
| Extension doesn't reload after a change     | Press `Ctrl+R` / `Cmd+R` in the Extension Development Host, or use the Reload Window command.   |
| `Error: Cannot find module 'out/extension'` | The `preLaunchTask` didn't run or failed — check the Terminal for compile errors.               |
| Proxy requests fail with 407                | Check credentials in `http.proxy`; use `Proxy-Authorization` header if needed.                  |
| Proxy SSL errors                            | Set `http.proxyStrictSSL: false` or install the corporate root CA.                              |

---

## 10. Quick Reference

| Action                | Shortcut                                |
| :-------------------- | :-------------------------------------- |
| Start debugging       | `F5`                                    |
| Reload Extension Host | `Ctrl+R` / `Cmd+R` (in the host window) |
| Toggle breakpoint     | `F9`                                    |
| Step over             | `F10`                                   |
| Step into             | `F11`                                   |
| Step out              | `Shift+F11`                             |
| Continue              | `F5`                                    |
| Stop debugging        | `Shift+F5`                              |
| Open Output panel     | `Ctrl+Shift+U` / `Cmd+Shift+U`          |
| Open Command Palette  | `Ctrl+Shift+P` / `Cmd+Shift+P`          |

---

## 11. Recommended Debugging Order

For a fast, repeatable loop:

1. Open the **Run and Debug** panel.
2. Select **"Run Extension"**.
3. Set breakpoints in `getWebContent.ts` and `proxyConfig.ts`.
4. Press **F5**.
5. In the Extension Development Host, run the debug command:
   ```
   > Get Web Content: Debug
   ```
6. Step through `invoke()` → `buildAxiosConfig()` → `axios.get()` → `summarizeWithCopilot()`.
7. Inspect variables at each step.
8. When done, **Shift+F5** to stop.

With this setup you can break on any line of `getWebContent.ts` or `proxyConfig.ts`, inspect the parsed HTML, the extracted text, the resolved proxy, and the model response — all without leaving VS Code.
