"use strict";

import * as vscode from "vscode-languageserver";
import { DafnyServer } from "../dafnyServer";
import { DafnyVerbs, EnvironmentConfig, ShortyString } from "./../../strings/stringRessources";
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
     * Extract and Convert the log to JSON
     * @param log Log from server
     * @returns Object representation of results
     */
    private static parseReport(log: string): any{
        const startOfReport: number = log.indexOf(EnvironmentConfig.DeadAnnotationsStart) + EnvironmentConfig.DeadAnnotationsStart.length;
        const endOfReport: number = log.indexOf(EnvironmentConfig.DeadAnnotationsEnd);
        const jsonstring: string = log.substring(startOfReport, endOfReport);
        return JSON.parse(jsonstring);
    }

    /**
     * Convert server results into normalised format
     * @param info Object representation of server results
     * @returns Array of dead annotation results
     */
    private static convertJsonToResults(info: any): DeadAnnotationResult[]{
        const allResults: DeadAnnotationResult[] = [];
        info.forEach(dareInfo => {
            const result = new DeadAnnotationResult();
            result.line = dareInfo.line;
            result.col = dareInfo.col;
            result.length = dareInfo.length+1;
            result.replacement = decodeBase64String(dareInfo.replacement);
            result.success = true;
            allResults.push(result);
        });
        return allResults;
    }

    /**
     * Remove any duplicate results or results that fall within the scope of a larger one
     * @param allResults All results from the server
     * @param document The document object from the request
     * @returns Array of DeadAnnotationResult without dupes
     */
    private static filterDuplicates(allResults: DeadAnnotationResult[], document: vscode.TextDocument): DeadAnnotationResult[]{
        allResults.sort((a, b)=>{return b.length - a.length});
        let ignore: number[] = [];
        for (let index = 0; index < allResults.length; index++) {
            if(ignore.includes(index)){
                continue;
            }
            const longItem = allResults[index];
            const longStart = document.offsetAt(vscode.Position.create(longItem.line-1, longItem.col-1));
            const longEnd = longStart+longItem.length;
            for (let shorterIndex = index+1; shorterIndex < allResults.length; shorterIndex++) {
                if(ignore.includes(index)){
                    continue;
                }
                const shorterItem = allResults[shorterIndex];
                const shortStart = document.offsetAt(vscode.Position.create(shorterItem.line-1, shorterItem.col-1));
                const shortEnd = shortStart+shorterItem.length;
                if(shortStart >= longStart && shortEnd <= longEnd){
                    ignore.push(shorterIndex);
                }
            }
        }
        return allResults.filter((_, index) => {return !ignore.includes(index)});
    }

    /**
     * Create diagnostics from the results to send to the client
     * @param filteredResults to notify the client with
     * @param document the active document from the request
     * @returns an array of diagnostic information
     */
    private static processResults(filteredResults: DeadAnnotationResult[], document: vscode.TextDocument): vscode.Diagnostic[]{
        const diagnostics: vscode.Diagnostic[] = [];
        filteredResults.forEach(result => {
            const diagPositionStart = vscode.Position.create(result.line-1, result.col-1);
            const diagPositionEnd = document.positionAt(document.offsetAt(diagPositionStart)+result.length);
            const range: vscode.Range = vscode.Range.create(diagPositionStart, diagPositionEnd);
            const diagnostic = vscode.Diagnostic.create(
                range,
                result.replacement === "" ? ShortyString.Remove : ShortyString.SimplifyPrefix + result.replacement,
                vscode.DiagnosticSeverity.Information,
                result.replacement === "" ? ShortyString.DiagnosticCodeRemove : ShortyString.DiagnosticCodeSimplify,
                ShortyString.DiagnosticSource);
            diagnostics.push(diagnostic);
        });
        return diagnostics;
    }

    /**
     * Handle the output of a check for dead annotations
     * @param log The log returned from Dafnyserver.exe
     * @param notificationService for sending response back
     * @param context The context of the request
     */
    public handleProcessData(log: string, notificationService: NotificationService, context: Context): void {
        let diagnostics: vscode.Diagnostic[] = [];
        let response = {success: true, message: ""};
        if(!log || log.indexOf(EnvironmentConfig.DafnySuccess) < 0 || log.indexOf(EnvironmentConfig.DeadAnnotationsStart) < 0) {
            response = {success: false, message: ShortyString.LogParseFail};
        }
        const info = DeadAnnotationService.parseReport(log);
        if(info.error){
            response = {success:false, message: info.error};
        } else {
            const allResults = DeadAnnotationService.convertJsonToResults(info);
            const filteredResults = DeadAnnotationService.filterDuplicates(allResults, context.activeRequest.document);
            diagnostics = DeadAnnotationService.processResults(filteredResults, context.activeRequest.document);
            response = {success:true, message: ""};
        }
        notificationService.sendDeadAnnotationResult([context.activeRequest.document.uri.toString(), JSON.stringify(response)]);
        const publishDiagnosticsParams: vscode.PublishDiagnosticsParams = { uri: context.activeRequest.document.uri.toString(), diagnostics: diagnostics };
        notificationService.sendDiagnostics(publishDiagnosticsParams);
    }
}
