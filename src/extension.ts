import * as vscode from 'vscode';
import { GetWebContentTool } from './tools/getWebContent';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.lm.registerTool('get_web_content', new GetWebContentTool())
    );
    console.log('Copilot Get Web Content Tool activated.');
}

export function deactivate() { }