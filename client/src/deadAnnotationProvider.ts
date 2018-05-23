"use strict";
import * as vscode from "vscode";
import { ShortyString } from "./stringRessources";

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
         _range: vscode.Range,
         context: vscode.CodeActionContext,
         _token: vscode.CancellationToken):
         vscode.ProviderResult<vscode.Command[]> {
        const commandList: vscode.Command[] = [];

        //@ts-ignore: TS Doesn't Recognise getDiagnostics, though it does exist
        const allDiagsForFile: vscode.Diagnostic[] = vscode.languages.getDiagnostics(document.uri).filter(value => value.source === ShortyString.DiagnosticSource);
        if(allDiagsForFile.length === 0){
            return null;
        }

        context.diagnostics.filter(value => value.source === ShortyString.DiagnosticSource).forEach(diagnostic => {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.replace(vscode.Uri.file(document.fileName), diagnostic.range, DeadAnnotationProvider.replacementForDiagnostic(diagnostic));
            //@ts-ignore: TS Doesn't Recognise CodeAction, though it does exist
            const codeAction = new vscode.CodeAction(
                DeadAnnotationProvider.actionPromptForReplacement(diagnostic),
                //@ts-ignore: TS Doesn't Recognise CodeActionKind, though it does exist
                vscode.CodeActionKind.RefactorRewrite
            )
            codeAction.edit = workspaceEdit;
            codeAction.diagnostics = [diagnostic];
            commandList.push(codeAction);
        });

        const workspaceEditAll = new vscode.WorkspaceEdit();
        allDiagsForFile.forEach(diagnostic => {
            workspaceEditAll.replace(vscode.Uri.file(document.fileName), diagnostic.range, DeadAnnotationProvider.replacementForDiagnostic(diagnostic));
        });
        //@ts-ignore: TS Doesn't Recognise CodeAction, though it does exist
        const codeActionAll = new vscode.CodeAction(
            ShortyString.MenuFixAll,
            //@ts-ignore: TS Doesn't Recognise CodeActionKind, though it does exist
            vscode.CodeActionKind.RefactorRewrite
        )
        codeActionAll.edit = workspaceEditAll;
        codeActionAll.diagnostics = allDiagsForFile;
        commandList.push(codeActionAll);

        return commandList;
    }

    private static replacementForDiagnostic(diagnostic: vscode.Diagnostic): string {
        if(diagnostic.code === ShortyString.DiagnosticCodeRemove){
            return "";
        }
        return diagnostic.message.substr(ShortyString.SimplifyPrefix.length);
    }

    private static actionPromptForReplacement(diagnostic: vscode.Diagnostic): string {
        if(diagnostic.code === ShortyString.DiagnosticCodeRemove){
            return ShortyString.MenuRemove;
        }
        return ShortyString.MenuSimplify;
    }

    constructor(){ }

    /**
     * Handle response from langauge server
     * @param result object {success:bool, message:string}
     */
    public handleResponse(result: any){
        if(!result.success){
            vscode.window.showErrorMessage(ShortyString.ServerFailPrefix + result.message);
        }
    }
}
