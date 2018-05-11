"use strict";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { TextDocumentItem } from "vscode-languageserver-types";
import { Context } from "./context";
import { CounterModelProvider } from "./counterModelProvider";
import { Statusbar } from "./dafnyStatusbar";
import { DotGraphProvider } from "./dotGraphProvider";
import { Commands, Config, EnvironmentConfig, LanguageServerNotification } from "./stringRessources";
import { VerificationResult } from "./verificationResult";
import { TacticProvider } from "./tacticProvider";

export class DafnyClientProvider {
    public dafnyStatusbar: Statusbar;
    private docChangeTimers: { [docPathName: string]: NodeJS.Timer } = {};
    private docChangeVerify: boolean = false;
    private docChangeDelay: number = 0;
    private automaticShowCounterExample: boolean = false;
    private subscriptions: vscode.Disposable[];
    private tacticProvider: TacticProvider;

    private counterModelProvider: CounterModelProvider;
    private context: Context;
    private dotGraphProvider: DotGraphProvider;
    private previewUri = vscode.Uri.parse("dafny-preview:State Visualization");

    constructor(public vsCodeContext: vscode.ExtensionContext, public languageServer: LanguageClient) {
        this.loadConfig();
        this.context = new Context();
        this.dafnyStatusbar = new Statusbar(this.languageServer, this.context);
        this.counterModelProvider = new CounterModelProvider(this.context);
        this.dotGraphProvider = new DotGraphProvider(this.languageServer);

        languageServer.onNotification(LanguageServerNotification.VerificationResult,
            (docPathName: string, json: string) => {
                this.context.localQueue.remove(docPathName);
                const verificationResult: VerificationResult = JSON.parse(json);
                if (Context.unitTest) { Context.unitTest.verificationComplete(verificationResult); };
                this.context.verificationResults[docPathName] = verificationResult;
                this.dafnyStatusbar.update();
                this.counterModelProvider.update();
            });

        this.tacticProvider = new TacticProvider(this.languageServer);
        languageServer.onNotification(LanguageServerNotification.TacticsPreview,
            (docPathName: string, json: string) => {
                this.context.localQueue.remove(docPathName);
                this.tacticProvider.handleExpandResponse(docPathName, JSON.parse(json), false);
                this.dafnyStatusbar.update();
            });
        languageServer.onNotification(LanguageServerNotification.TacticsReplace,
            (docPathName: string, json: string) => {
                this.context.localQueue.remove(docPathName);
                this.tacticProvider.handleExpandResponse(docPathName, JSON.parse(json), true);
                this.dafnyStatusbar.update();
            });

    }

    public activate(subs: vscode.Disposable[]): void {
        /*vscode.workspace.textDocuments.forEach((e) => {
            this.doVerify(e);
        }, this);*/

        vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => {
            if (editor) {
                this.dafnyStatusbar.update();
                this.counterModelProvider.update();
            }
        }, this);
        this.subscriptions = subs;
        vscode.workspace.onDidOpenTextDocument(this.doVerify, this);

        if (this.docChangeVerify) {
            vscode.workspace.onDidChangeTextDocument(this.docChanged, this);
        }
        vscode.workspace.onDidSaveTextDocument(this.doVerify, this);
        vscode.workspace.onDidCloseTextDocument(this.hideCounterModel, this);

        vscode.workspace.registerTextDocumentContentProvider("dafny-preview", this.dotGraphProvider);
        try{
            vscode.commands.registerCommand(Commands.ShowDotGraph, () => {
                vscode.commands.executeCommand("vscode.previewHtml", this.previewUri, vscode.ViewColumn.Two);
            });

            vscode.commands.registerCommand(Commands.ShowCounterExample, () => {
                this.doCounterModel(vscode.window.activeTextEditor.document);
            });

            vscode.commands.registerCommand(Commands.HideCounterExample, () => {
                this.hideCounterModel(vscode.window.activeTextEditor.document);
            });

            vscode.commands.registerCommand(Commands.ToggleTacticVerification, () => {
                this.toggleTacticVerification(vscode.window.activeTextEditor.document);
            });

            vscode.commands.registerCommand(Commands.PreviewhisTactic, () => {
                this.previewThisTactic(vscode.window.activeTextEditor);
            });

            vscode.commands.registerCommand(Commands.ReplaceThisTactic, () => {
                this.replaceThisTactic(vscode.window.activeTextEditor);
            });

            vscode.commands.registerCommand(Commands.CheckDeadAnnotations, () => {
                this.checkDeadAnnotations(vscode.window.activeTextEditor.document);
            });

        } catch (e) {
            if(e.message === "command 'dafny.showDotGraph' already exists"){
                /* The commands have already been added, we are just restarting the dafnyserver */
            } else {
                throw e;
            }
        }

        const that = this;
        vscode.workspace.onDidChangeConfiguration(this.loadConfig, that);

        if (Context.unitTest) { Context.unitTest.activated(); };
    }

    /**
     * Toggle the verification of tactics in dafnyserver
     * @param activeDocument the currently active text editor document
     */
    public toggleTacticVerification(activeDocument: vscode.TextDocument): void{
        this.sendDocument(activeDocument, LanguageServerNotification.TacticsToggle);
    }

    /**
     * Find the position of the cursor and expand the tactic below it, previewing the result
     * @param activeEditor The currently active editor
     */
    public previewThisTactic(activeEditor: vscode.TextEditor): void{
        this.context.localQueue.add(activeEditor.document.uri.toString());
        this.tacticProvider.preview(activeEditor);
    }

    /**
     * Find the position of the cursor and expand the tactic below it, replacing the call
     * @param activeEditor The currently active editor
     */
    public replaceThisTactic(activeEditor: vscode.TextEditor): void{
        this.context.localQueue.add(activeEditor.document.uri.toString());
        this.tacticProvider.replace(activeEditor);
    }

    /**
     * Run the Dead annotation removal tool on the document
     * @param activeDocument The currently active text document
     */
    public checkDeadAnnotations(activeDocument: vscode.TextDocument): void{
        this.sendDocument(activeDocument, LanguageServerNotification.DeadAnnotationCheck);
    }

    public dispose(): void {
        this.dafnyStatusbar.hide();
        if (this.subscriptions && this.subscriptions.length > 0) {
            for (let i: number = 0; i < this.subscriptions.length; i++) {
                this.subscriptions[i].dispose();
            }
        }
    }

    private loadConfig() {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
        this.docChangeVerify = config.get<boolean>(Config.AutomaticVerification);
        this.docChangeDelay = config.get<number>(Config.AutomaticVerificationDelay);
        this.automaticShowCounterExample = config.get<boolean>(Config.AutomaticShowCounterExample);
    }

    private doCounterModel(textDocument: vscode.TextDocument): void {
        this.sendDocument(textDocument, LanguageServerNotification.CounterExample);
    }

    private doVerify(textDocument: vscode.TextDocument): void {
        this.hideCounterModel(textDocument);
        if (this.automaticShowCounterExample) {
            this.sendDocument(textDocument, LanguageServerNotification.CounterExample);
        } else {
            this.sendDocument(textDocument, LanguageServerNotification.Verify);
        }

    }

    private hideCounterModel(textDocument: vscode.TextDocument): void {
        if (this.context.decorators[textDocument.uri.toString()]) {
            this.context.decorators[textDocument.uri.toString()].dispose();
        }
    }

    private sendDocument(textDocument: vscode.TextDocument, type: string): void {
        if (textDocument !== null && textDocument.languageId === EnvironmentConfig.Dafny) {
            this.context.localQueue.add(textDocument.uri.toString());
            const tditem = JSON.stringify(TextDocumentItem.create(textDocument.uri.toString(),
                textDocument.languageId, textDocument.version, textDocument.getText()));
            this.languageServer.sendNotification(type, tditem);
        }
    }

    private docChanged(change: vscode.TextDocumentChangeEvent): void {
        if (change !== null && change.document !== null && change.document.languageId === EnvironmentConfig.Dafny) {

            const docName: string = change.document.fileName;

            if (this.docChangeTimers[docName]) {
                clearTimeout(this.docChangeTimers[docName]);
            }

            this.docChangeTimers[docName] = setTimeout(() => {
                this.doVerify(change.document);
            }, this.docChangeDelay);
        }
    }
}
