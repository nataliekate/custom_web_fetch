import * as vscode from "vscode";
import * as requestLight from "request-light";

interface MyFetchInput {
    url: string;
}

class MyFetchTool
    implements vscode.LanguageModelTool<MyFetchInput> {

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<MyFetchInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {

        return {
            invocationMessage: `Fetching ${options.input.url}`,
            confirmationMessages: {
                title: "Fetch web page",
                message: new vscode.MarkdownString(
                    `Fetch content from \`${options.input.url}\``
                )
            }
        };
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<MyFetchInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {

        const url = validateUrl(options.input.url);

        const response = await fetchUrl(url);

        const text = htmlToText(
            response.body
        );

        if (!text) {
            throw new Error(
                "No readable text was found on the page."
            );
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
                `URL: ${url}\n\n${text}`
            )
        ]);
    }
}

function validateUrl(raw: string): URL {
    let url: URL;

    try {
        url = new URL(raw);
    } catch {
        throw new Error(`Invalid URL: ${raw}`);
    }

    if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
    ) {
        throw new Error(
            "Only HTTP and HTTPS URLs are supported."
        );
    }

    if (url.username || url.password) {
        throw new Error(
            "URLs containing credentials are not supported."
        );
    }

    return url;
}

interface FetchResult {
    body: string;
}

async function fetchUrl(
    url: URL
): Promise<FetchResult> {

    const httpConfig =
        vscode.workspace.getConfiguration("http");

    const proxy =
        httpConfig.get<string | undefined>(
            "proxy"
        );

    const proxyStrictSSL =
        httpConfig.get<boolean>(
            "proxyStrictSSL",
            true
        );

    const proxyAuthorization =
        httpConfig.get<string | undefined>(
            "proxyAuthorization"
        );

    const response =
        await requestLight.xhr({
            type: "GET",
            url: url.toString(),

            timeout: 15000,

            headers: {
                "User-Agent":
                    "VSCode-MyWebFetch/0.0.1",

                "Accept":
                    "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",

                ...(proxyAuthorization
                    ? {
                        "Proxy-Authorization":
                            proxyAuthorization
                    }
                    : {})
            },

            // request-light supports proxy configuration.
            proxy,

            strictSSL: proxyStrictSSL
        });

    return {
        body: response.responseText
    };
}

function htmlToText(html: string): string {

    let text = html;

    // Remove scripts/styles.
    text = text.replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " "
    );

    text = text.replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " "
    );

    text = text.replace(
        /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
        " "
    );

    // Preserve some structure.
    text = text.replace(
        /<\/(p|div|section|article|main|li|ul|ol|h[1-6]|pre|blockquote)>/gi,
        "\n"
    );

    text = text.replace(
        /<br\s*\/?>/gi,
        "\n"
    );

    // Remove remaining HTML tags.
    text = text.replace(
        /<[^>]+>/g,
        " "
    );

    // Decode a few common entities.
    text = text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");

    // Normalize whitespace.
    text = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return text;
}

export function activate(
    context: vscode.ExtensionContext
): void {

    context.subscriptions.push(
        vscode.lm.registerTool(
            "my-web-fetch_fetch",
            new MyFetchTool()
        )
    );
}

export function deactivate(): void {}