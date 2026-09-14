import * as vscode from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { buildAxiosConfig, describeProxy } from './proxyConfig';

interface IGetWebContentInput {
  url: string;
}

export class GetWebContentTool implements vscode.LanguageModelTool<IGetWebContentInput> {

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IGetWebContentInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Fetching and summarizing: ${options.input.url}`
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IGetWebContentInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {

    const url = options.input.url;

    if (!url || !/^https?:\/\//i.test(url)) {
      return this.error('Please provide a valid URL starting with http:// or https://.');
    }

    try {
      // --- 1. Fetch with proxy-aware Axios config ---
      const axiosConfig = buildAxiosConfig({
        'User-Agent': 'Mozilla/5.0 (compatible; VSCodeCopilotTool/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      });

      console.log(`[get_web_content] Fetching ${url}. ${describeProxy()}`);

      const response = await axios.get(url, axiosConfig);
      const html = response.data as string;

      // --- 2. Extract readable text ---
      const $ = cheerio.load(html);
      $('script, style, noscript, iframe, nav, footer, header, aside, form, button, svg, template').remove();

      let textContent = $('main, article, [role="main"], .content, .post, .article').text();
      if (!textContent || textContent.trim().length < 100) {
        textContent = $('body').text();
      }

      textContent = textContent.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();

      const maxChars = vscode.workspace
        .getConfiguration('getWebContent')
        .get<number>('maxContentChars', 12000);

      if (textContent.length > maxChars) {
        textContent = textContent.substring(0, maxChars) + '\n\n[...content truncated...]';
      }

      if (!textContent || textContent.length < 50) {
        return this.error(`Fetched ${url} but could not extract meaningful text content.`);
      }

      // --- 3. Summarize using Copilot Chat's model ---
      const summary = await this.summarizeWithCopilot(url, textContent, token);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(summary)
      ]);

    } catch (error: any) {
      const message = error.response
        ? `HTTP ${error.response.status} from ${url}`
        : error.message || 'Unknown error';
      return this.error(`Failed to fetch ${url}: ${message}`);
    }
  }

  /**
   * Uses Copilot Chat's language model (via the VS Code LM API) to summarize.
   * We select the Copilot vendor and pick the first model — which is the
   * same default model used by Copilot Chat itself.
   */
  private async summarizeWithCopilot(
    url: string,
    content: string,
    token: vscode.CancellationToken
  ): Promise<string> {

    // Select the Copilot model that backs Copilot Chat.
    // VS Code returns the user's currently preferred Copilot model first.
    let models = await vscode.lm.selectChatModels({ vendor: 'copilot' });

    // Fallback: any available model if Copilot isn't registered.
    if (models.length === 0) {
      models = await vscode.lm.selectChatModels();
    }

    if (models.length === 0) {
      // No model available — return raw extracted content.
      return `Content from ${url}:\n\n${content}`;
    }

    const model = models[0];
    console.log(
      `[get_web_content] Summarizing with ${model.vendor}/${model.family} ` +
      `(id=${model.id}, maxInputTokens=${model.maxInputTokens})`
    );

    const messages = [
      vscode.LanguageModelChatMessage.User(
        `You are a helpful assistant summarizing a web page for a developer.\n\n` +
        `URL: ${url}\n\n` +
        `Produce a concise summary (3–6 paragraphs) covering:\n` +
        `- The main topic and purpose of the page\n` +
        `- Key facts, figures, or arguments\n` +
        `- Any important conclusions or takeaways\n\n` +
        `Do not include HTML tags or fenced code blocks.\n\n` +
        `--- BEGIN PAGE CONTENT ---\n${content}\n--- END PAGE CONTENT ---`
      )
    ];

    const response = await model.sendRequest(messages, {}, token);

    let summary = '';
    for await (const fragment of response.text) {
      summary += fragment;
    }

    return `Summary of ${url}:\n\n${summary}`;
  }

  private error(message: string): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`Error: ${message}`)
    ]);
  }
}