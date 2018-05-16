"use strict";
import * as vscode from "vscode";
import { TextDocumentItem } from "vscode-languageserver-types";
import { LanguageClient } from "vscode-languageclient/lib/main";
import { EnvironmentConfig, LanguageServerNotification } from "./stringRessources";

export enum TacticExpanionStatus {
    NoTactic = 0,
    Success = 1,
    TranslationFail = 2,
    Unresolved = 3
}

export class TacticExpansionResult {
    public status: TacticExpanionStatus;
    public expansion: string;
    public startPosition: number;
    public endPosition: number;
}

/**
 * Class dealing with interactions relating to tactics
 */
export class TacticProvider {

    private tacticsChannel: vscode.OutputChannel;

    constructor(private languageServer: LanguageClient){ }

    /**
     * Deal with a request to expand (and preview) a tactic
     * @param activeEditor The editor where an expand request originated
     */
    public preview(activeEditor: vscode.TextEditor){
        this.expand(activeEditor, LanguageServerNotification.TacticsPreview);
    }

    /**
     * Deal with a request to expand (and replace the call of) a tactic
     * @param activeEditor The editor where an expand request originated
     */
    public replace(activeEditor: vscode.TextEditor){
        this.expand(activeEditor, LanguageServerNotification.TacticsReplace);
    }

    /**
     * Deal with a request to expand (and replace the call of) a tactic
     * @param activeEditor The editor where an expand request originated
     * @param verb the Verb to send to the server
     */
    private expand(activeEditor: vscode.TextEditor, verb: string) {
        const absolutePosition = activeEditor.document.offsetAt(activeEditor.selection.active);
        const textDocument: vscode.TextDocument = activeEditor.document;
        if (textDocument !== null && textDocument.languageId === EnvironmentConfig.Dafny) {
            const tditem = JSON.stringify({
                document: TextDocumentItem.create(
                    textDocument.uri.toString(),
                    textDocument.languageId,
                    textDocument.version,
                    textDocument.getText()
                ),
                position: absolutePosition
            });
            vscode.window.showInformationMessage(`Expanding the tactic at (${activeEditor.selection.active.line+1},${activeEditor.selection.active.character+1})`);
            this.languageServer.sendNotification(verb, tditem);
        } else {
            vscode.window.showWarningMessage("Can't expand the tactic at this position.");
        }
    }

    /**
     * Handle the response for an expansion from the server component
     * @param docPathName File expand request was made at
     * @param json The result from the server component
     */
    public handleExpandResponse(docPathName: string, tacticResult: TacticExpansionResult, isEdit: boolean){
        switch(tacticResult.status){
            case TacticExpanionStatus.NoTactic:
                vscode.window.showInformationMessage("No tactic to expand at this position");
                return;
            case TacticExpanionStatus.Success:
                if(isEdit){
                    this.handleSuccessEdit(docPathName, tacticResult);
                } else {
                    this.handleSuccessPreview(docPathName, tacticResult);
                }
                return;
            case TacticExpanionStatus.TranslationFail:
                vscode.window.showErrorMessage("Translator failed to expand the tactic");
                return;
            case TacticExpanionStatus.Unresolved:
                vscode.window.showWarningMessage("Program needs to be re-verified before expanding tactic");
                return;
            default:
                vscode.window.showErrorMessage("Dafny failed to run during expansion of tactic");
        }
    }

    /**
     * handle a successful expandsion and complete the text edit
     * @param docPathName the path to the document beign edited
     * @param tacticResult Output from Language Server
     */
    private handleSuccessEdit(docPathName: string, tacticResult: TacticExpansionResult){
        vscode.window.showTextDocument(vscode.Uri.file(docPathName));
        const editor: vscode.TextEditor = vscode.window.activeTextEditor;
        const editRange = new vscode.Range(
            editor.document.positionAt(tacticResult.startPosition),
            editor.document.positionAt(tacticResult.endPosition)
        )
        editor.edit((editBuilder: vscode.TextEditorEdit) => {
            editBuilder.replace(editRange, tacticResult.expansion);
            vscode.window.showInformationMessage("Expanded the tactic");
        });
    }

    /**
     * handle a successful expandsion and show the preview
     * @param docPathName the path to the document beign edited
     * @param tacticResult Output from Language Server
     */
    private handleSuccessPreview(docPathName: string, tacticResult: TacticExpansionResult){
        if(!this.tacticsChannel){
            this.tacticsChannel = vscode.window.createOutputChannel("Tactics");
        }
        this.tacticsChannel.show(true);
        this.tacticsChannel.appendLine(`[${docPathName}] Result of expansion at char ${tacticResult.startPosition}`);
        this.tacticsChannel.append(tacticResult.expansion);
        this.tacticsChannel.appendLine("");
    }
}
