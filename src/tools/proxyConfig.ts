import * as vscode from 'vscode';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import type { AxiosRequestConfig } from 'axios';

export interface ProxyInfo {
  url: string;
  strictSSL: boolean;
  source: 'vscode-setting' | 'env' | 'none';
}

/**
 * Resolves the effective proxy configuration for outbound HTTP requests.
 */
export function resolveProxy(): ProxyInfo {
  const useVSCodeProxy = vscode.workspace
    .getConfiguration('getWebContent')
    .get<boolean>('useVSCodeProxy', true);

  // 1. VS Code's http.proxy setting
  if (useVSCodeProxy) {
    const httpConfig = vscode.workspace.getConfiguration('http');
    const vscodeProxy = httpConfig.get<string>('proxy');
    const strictSSL = httpConfig.get<boolean>('proxyStrictSSL', true);

    if (vscodeProxy && vscodeProxy.trim().length > 0) {
      return {
        url: vscodeProxy.trim(),
        strictSSL,
        source: 'vscode-setting'
      };
    }
  }

  // 2. Environment variables (case-insensitive lookup)
  const env = process.env;
  const envProxy =
    env.HTTPS_PROXY || env.https_proxy ||
    env.HTTP_PROXY || env.http_proxy ||
    env.ALL_PROXY || env.all_proxy;

  if (envProxy && envProxy.trim().length > 0) {
    return {
      url: envProxy.trim(),
      strictSSL: true,
      source: 'env'
    };
  }

  return { url: '', strictSSL: true, source: 'none' };
}

/**
 * Builds the Axios request config with the resolved proxy agents applied.
 */
export function buildAxiosConfig(
  baseHeaders: Record<string, string> = {},
  timeoutMs = 15000
): AxiosRequestConfig {
  const proxy = resolveProxy();

  const config: AxiosRequestConfig = {
    headers: baseHeaders,
    timeout: timeoutMs,
    responseType: 'text',
    // Prevent axios from auto-detecting proxy via env vars,
    // since we're handling it explicitly via agents.
    proxy: false
  };

  if (proxy.url) {
    // Choose the correct agent based on the target protocol.
    // We provide both so axios can pick per-request.
    (config as any).httpAgent = new HttpProxyAgent(proxy.url);
    (config as any).httpsAgent = new HttpsProxyAgent(proxy.url, {
      rejectUnauthorized: proxy.strictSSL
    });

    console.log(
      `[get_web_content] Using proxy from ${proxy.source}: ${proxy.url} ` +
      `(strictSSL=${proxy.strictSSL})`
    );
  }

  return config;
}

/**
 * Returns a short human-readable description of the current proxy setup,
 * useful for logging and debugging.
 */
export function describeProxy(): string {
  const p = resolveProxy();
  if (p.source === 'none') {
    return 'No proxy configured';
  }
  return `Proxy (${p.source}): ${p.url}`;
}