"use strict";
import * as vscode from "vscode";

export class DeadAnnotationResult {
    public success: boolean;
    public replacement: string;
    public line: number;
    public col: number;
    public length: number;
}

/**
 * class for handling requests to cehck for dead annotations and for reporting results
 */
export class DeadAnnotationProvider implements vscode.CodeActionProvider {
    /**
     * Provide commands for the given document and range.
     * @param document The document in which the command was invoked.
     * @param range The range for which the command was invoked.
     * @param context Context carrying additional information
     * @param token A cancellation token.
     */
    public provideCodeActions(document: vscode.TextDocument,
         range: vscode.Range,
         context: vscode.CodeActionContext,
         token: vscode.CancellationToken):
         vscode.ProviderResult<vscode.Command[]> {
        let hasAnnotationFixes = false;
        const commandList: vscode.Command[] = [];
        context.diagnostics.forEach(diagnostic => {
            if(token.isCancellationRequested || diagnostic.code != "dare"){return;}
            hasAnnotationFixes = true;
            const workspaceEdit = new vscode.WorkspaceEdit();
            const replacement = diagnostic.source === "Dafny VSCode DARe - Remove Annotation" ? "" : diagnostic.message.substr("Simplify to: ".length);
            workspaceEdit.replace(vscode.Uri.file(document.fileName), diagnostic.range, replacement);
            //@ts-ignore: TS Doesn't Recognise CodeAction, though it does exist
            const codeAction = new vscode.CodeAction(
                diagnostic.source,
                //@ts-ignore: TS Doesn't Recognise CodeActionKind, though it does exist
                vscode.CodeActionKind.RefactorRewrite
            )
            codeAction.edit = workspaceEdit;
            codeAction.diagnostics = [diagnostic];
            commandList.push(codeAction);
        });

        //@ts-ignore: TS Doesn't Recognise getDiagnostics, though it does exist
        const allDiagsForFile: vscode.Diagnostic[] = vscode.languages.getDiagnostics(document.uri);
        const workspaceEditAll = new vscode.WorkspaceEdit();
        allDiagsForFile.forEach(diagnostic => {
            if(token.isCancellationRequested || diagnostic.code != "dare"){return;}
            hasAnnotationFixes = true;
            const replacement = diagnostic.source === "Dafny VSCode DARe - Remove Annotation" ? "" : diagnostic.message.substr("Simplify to: ".length);
            workspaceEditAll.replace(vscode.Uri.file(document.fileName), diagnostic.range, replacement);
        });
        //@ts-ignore: TS Doesn't Recognise CodeAction, though it does exist
        const codeActionAll = new vscode.CodeAction(
            "Fix all annotations in file",
            //@ts-ignore: TS Doesn't Recognise CodeActionKind, though it does exist
            vscode.CodeActionKind.RefactorRewrite
        )
        codeActionAll.edit = workspaceEditAll;
        codeActionAll.diagnostics = allDiagsForFile;
        commandList.push(codeActionAll);

        return token.isCancellationRequested || !hasAnnotationFixes ? null : commandList;
    }

    constructor(){ }

    /**
     * Handle response from langauge server
     * @param result object {success:bool, message:string}
     */
    public handleResponse(result: any){
        if(!result.success){
            vscode.window.showErrorMessage(`Failed to check for dead annotations: ${result.message}`);
        }
    }
}
