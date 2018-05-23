"use strict";
import * as vscode from "vscode";
import { TextDocumentItem } from "vscode-languageserver-types";
import { LanguageClient } from "vscode-languageclient/lib/main";
import { EnvironmentConfig, LanguageServerNotification, TacticString } from "./stringRessources";

export enum TacticExpanionStatus {
    NoTactic = 0,
    Success = 1,
    Unresolved = 2,
    UnexpectedFailure = 3
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
     * Deal with a request to expand (and replace the call of) all tactic
     *   We don't care about the position for this, but sending it anyway helps reusability
     * @param activeEditor The editor where an expand request originated
     */
    public replaceAll(activeEditor: vscode.TextEditor){
        this.expand(activeEditor, LanguageServerNotification.TacticsReplaceAll);
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
            this.languageServer.sendNotification(verb, tditem);
        } else {
            vscode.window.showWarningMessage(TacticString.CantExpand);
        }
    }

    /**
     * Handle the response for an expansion from the server component
     * @param docPathName File expand request was made at
     * @param tacticResults List of expansions from the server
     */
    public handleExpandResponse(docPathName: string, tacticResults: TacticExpansionResult[], isEdit: boolean){
        switch(tacticResults[0].status){
            case TacticExpanionStatus.NoTactic:
                vscode.window.showInformationMessage(TacticString.NoTactic);
                return;
            case TacticExpanionStatus.Success:
                if(isEdit){
                    this.handleSuccessEdit(docPathName, tacticResults);
                } else {
                    this.handleSuccessPreview(docPathName, tacticResults);
                }
                return;
            case TacticExpanionStatus.Unresolved:
                vscode.window.showWarningMessage(TacticString.MustReVerify);
                return;
            default:
                vscode.window.showErrorMessage(TacticString.DafnyFailed);
                console.error(TacticString.DafnyFailed + " - " + tacticResults[0].expansion)
        }
    }

    /**
     * handle a successful expandsion and complete the text edit
     * @param docPathName the path to the document beign edited
     * @param tacticResult Output from Language Server
     */
    private handleSuccessEdit(docPathName: string, tacticResults: TacticExpansionResult[]){
        vscode.window.showTextDocument(vscode.Uri.file(docPathName));
        const editor: vscode.TextEditor = vscode.window.activeTextEditor;
        editor.edit((editBuilder: vscode.TextEditorEdit) => {
            tacticResults.forEach(tacticResult => {
                const editRange = new vscode.Range(
                    editor.document.positionAt(tacticResult.startPosition),
                    editor.document.positionAt(tacticResult.endPosition)
                );
                editBuilder.replace(editRange, tacticResult.expansion);
            });
        });
    }

    /**
     * handle a successful expandsion and show the preview
     * @param docPathName the path to the document beign edited
     * @param tacticResult Output from Language Server
     */
    private handleSuccessPreview(docPathName: string, tacticResults: TacticExpansionResult[]){
        if(!this.tacticsChannel){
            this.tacticsChannel = vscode.window.createOutputChannel(TacticString.OutputChannelName);
        }
        this.tacticsChannel.show(true);
        tacticResults.forEach(tacticResult => {
            this.tacticsChannel.appendLine(`[${docPathName}]` + TacticString.OutputChannelMessage + tacticResult.startPosition);
            this.tacticsChannel.append(tacticResult.expansion);
            this.tacticsChannel.appendLine("");
        });
    }
}
