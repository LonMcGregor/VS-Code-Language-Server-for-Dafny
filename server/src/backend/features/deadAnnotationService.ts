"use strict";

import * as vscode from "vscode-languageserver";
import { DafnyServer } from "../dafnyServer";
import { DafnyVerbs, EnvironmentConfig } from "./../../strings/stringRessources";
import { NotificationService } from "../../notificationService";
import { Context } from "../context";
import { decodeBase64String } from "../../strings/stringEncoding";

export class DeadAnnotationResult {
    public success: boolean;
    public replacement: string;
    public line: number;
    public col: number;
    public length: number;
}

/**
 * Class that deals with interactions relating to dead annotation check requests
 */
export class DeadAnnotationService {
    constructor(public server: DafnyServer){ }

    /**
     * Handle the output of a check for dead annotations
     * @param log The log returned from Dafnyserver.exe
     * @param notificationService for sending response back
     * @param context The context of the request
     */
    public handleProcessData(log: string, notificationService: NotificationService, context: Context): void {
        const results: DeadAnnotationResult[] = [];
        const diagnostics: vscode.Diagnostic[] = []
        if(log && log.indexOf(EnvironmentConfig.DafnySuccess) > 0 && log.indexOf(EnvironmentConfig.DeadAnnotationsStart) > -1) {
            const startOfReport: number = log.indexOf(EnvironmentConfig.DeadAnnotationsStart) + EnvironmentConfig.DeadAnnotationsStart.length;
            const endOfReport: number = log.indexOf(EnvironmentConfig.DeadAnnotationsEnd);
            const jsonstring: string = log.substring(startOfReport, endOfReport);
            const info = JSON.parse(jsonstring);
            if(info.error){
                const report = new DeadAnnotationResult();
                report.success = false;
                report.replacement = info.error;
                results.push(report);
            } else {
                info.forEach(dareInfo => {
                    const result = new DeadAnnotationResult();
                    result.line = dareInfo.line;
                    result.col = dareInfo.col;
                    result.length = dareInfo.length;
                    result.replacement = decodeBase64String(dareInfo.replacement);
                    result.success = true;
                    const diagPositionStart: vscode.Position = vscode.Position.create(result.line-1, result.col-1);
                    const diagPositionEnd: vscode.Position = vscode.Position.create(result.line-1, result.col+result.length-1);
                    const range: vscode.Range = vscode.Range.create(diagPositionStart, diagPositionEnd);
                    const diagMsg: string = result.replacement === "" ? "Statement can be removed" : "Simplify to " + result.replacement;
                    const diagnostic = vscode.Diagnostic.create(range, diagMsg, vscode.DiagnosticSeverity.Warning, "dare", "Dafny VSCode");
                    results.push(result);
                    diagnostics.push(diagnostic);
                });
            }

        }
        notificationService.sendDeadAnnotationResult([context.activeRequest.document.uri.toString(), JSON.stringify(results)]);
        const publishDiagnosticsParams: vscode.PublishDiagnosticsParams = { uri: context.activeRequest.document.uri.toString(), diagnostics: diagnostics };
        notificationService.sendDiagnostics(publishDiagnosticsParams);
    }
}
