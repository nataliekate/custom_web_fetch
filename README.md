# My Web Fetch

A VS Code extension that provides a GitHub Copilot Language Model Tool:

`#my_fetch`

The tool fetches readable text from HTTP/HTTPS web pages.

## Usage

In GitHub Copilot Chat:

#my_fetch https://example.com

Then ask Copilot to summarize, analyze, or otherwise work with the retrieved content.

You can also let the agent decide when to invoke the tool based on its description.

## Configuration

### `myWebFetch.timeoutMs`

Maximum request duration.

Default:

`15000`

### `myWebFetch.maxResponseBytes`

Maximum response body size.

Default:

`5242880`

### `myWebFetch.maxOutputCharacters`

Maximum text returned to Copilot.

Default:

`100000`

### `myWebFetch.allowedHosts`

Optional host allowlist.

Example:

`[
"developer.mozilla.org",
"docs.github.com",
"example.com"
]`

An empty array means any public HTTP/HTTPS host.

## Security

The extension:

- only allows HTTP/HTTPS
- rejects URLs with embedded credentials
- rejects localhost
- rejects loopback addresses
- rejects private IPv4 ranges
- rejects private IPv6 ranges
- rejects multicast addresses
- supports an optional host allowlist
- limits response size
- limits output size
- supports cancellation and timeout

Redirects are intentionally disabled.

## Build

Install dependencies:

```bash
npm install
```

Compile:
```bash
npm run compile
```

Package with vsce:
```bash
npx @vscode/vsce package
```
Then install the generated VSIX in VS Code.

## Configure the proxy

The extension reads these existing VS Code settings:
```json
{
  "http.proxy": "http://proxy.company.com:8080",
  "http.proxyStrictSSL": true
}
```

## For authenticated proxies, VS Code's setting may contain the authorization information:
```json
{
  "http.proxyAuthorization": "Basic xxxxx"
}
```
