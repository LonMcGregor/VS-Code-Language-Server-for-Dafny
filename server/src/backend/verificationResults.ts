"use strict";

import * as vscode from "vscode-languageserver";

import { NotificationService } from "../notificationService";

import { Verification } from "../strings/regexRessources";
import { EnvironmentConfig, Severity, TacticString } from "../strings/stringRessources";
import { VerificationRequest } from "./verificationRequest";
import { parse } from "path";
import { decodeBase64String } from "../strings/stringEncoding";

export enum VerificationStatus {
    Verified = 0,
    NotVerified = 1,
    Failed = 2,
};

export class VerificationResult {
    public verificationStatus: VerificationStatus;
    public proofObligations: number;
    public errorCount: number;
    public crashed: boolean = false;
    public counterModel: any;
    public tacticsEnabled: boolean;
};

export class VerificationResults {
    public latestResults: { [docPathName: string]: VerificationResult } = {};
    private diagCol: vscode.PublishDiagnosticsParams;

    constructor(private notificationService: NotificationService) { }

    public collect(log: string, req: VerificationRequest): VerificationResult {
        const verificationResult: VerificationResult = this.parseVerifierLog(log, req);
        const fileName: string = req.document.uri;
        this.latestResults[fileName] = verificationResult;
        return verificationResult;
    }

    public addCrashed(req: VerificationRequest): void {
        if (req != null) {
            const verificationResult: VerificationResult = new VerificationResult();
            verificationResult.crashed = true;
            const fileName: string = req.document.uri;
            this.latestResults[fileName] = verificationResult;
        }
    }

    /**
     * Parse a special json report form log and fill in the diags.
     *
     * @param log Output from DafnyServer.exe
     * @param diags An initialized diagnostics list
     * @param errorCount total number of errors encountered
     * @param specialReportingStart the token delimiting the start of the reporting to analyse
     * @param specialReportingEnd the token delimiting the end of the reporting to analyse
     * @param reportMethod a specified method for analysing a report
     * @returns the newly updated error count
     */
    private parseSpecialReporting(log:string, diags: vscode.Diagnostic[], errorCount:number,
         specialReportingStart: string, specialReportingEnd:string, reportMethod:(any)=>vscode.Diagnostic):number{
        if(log.indexOf(specialReportingStart) > -1) {
            const startOfReport: number = log.indexOf(specialReportingStart) + specialReportingStart.length;
            const endOfReport: number = log.indexOf(specialReportingEnd);
            const info: string = log.substring(startOfReport, endOfReport);
            try {
                const parsedJson: any = JSON.parse(info);
                if(parsedJson != []){
                    parsedJson.forEach(reportInfo => {
                        errorCount++;
                        diags.push(reportMethod(reportInfo));
                    });
                }
            } catch(exception) {
                console.error("Failure  to parse response: " + exception + ", json: " + info);
                return null;
            }
        }
        return errorCount;
    }

    /**
     * Parse a reportInfo json object from Tactics
     * @param reportInfo the JSON report info from the tactics report
     * @returns an appropriate diagnostic report for Tactics
     */
    private parseTacticReport(reportInfo): vscode.Diagnostic{
        const diagPositionStart: vscode.Position = vscode.Position.create(reportInfo["Tok"]["line"], reportInfo["Tok"]["col"]);
        const diagPositionEnd: vscode.Position = vscode.Position.create(reportInfo["Tok"]["line"], reportInfo["Tok"]["col"]+1);
        const range: vscode.Range = vscode.Range.create(diagPositionStart, diagPositionEnd);
        const diagMsg: string = reportInfo["Msg"];
        return vscode.Diagnostic.create(range, diagMsg, vscode.DiagnosticSeverity.Error, TacticString.DiagnosticCode, TacticString.DiagnosticSource);
    }

    /**
     * Check the state of tactic verification
     * @param log Output from DafnyServer.exe
     * @param diags An initialized diagnostics list
     * @returns whether the tactic verification is enabled
     */
    private parseTacticVerificationEnabled(log:string): boolean{
        if(log.indexOf(EnvironmentConfig.TacticVerificationEnabled) > -1) {
            const reportStart: number = log.indexOf(EnvironmentConfig.TacticVerificationEnabled);
            const stateStart: number = reportStart+EnvironmentConfig.TacticVerificationEnabled.length;
            const stateOfReporting: string = log.substring(stateStart, stateStart+1);
            return stateOfReporting==="T";
        }
        return false;
    }

    private parseVerifierLog(log: string, req: VerificationRequest): VerificationResult {
        const result: VerificationResult = new VerificationResult();
        const lines: string[] = log.split(EnvironmentConfig.NewLine);
        const diags: vscode.Diagnostic[] = [];
        let errorCount: number = 0;
        let proofObligations: number = 0;
        let lastDiagnostic = null;
        let relatedLocationCounter = 1;

        this.addCounterModel(log, result);

        if (log.indexOf("Unknown verb") !== -1) {
            errorCount++;
            diags.push({
                message: "Please upgrade Dafny. The verification can't be executed.",
                range: {
                    end: { character: Number.MAX_VALUE, line: Number.MAX_VALUE },
                    start: { character: 0, line: 0 }
                },
                severity: vscode.DiagnosticSeverity.Error, source: "Dafny VSCode"
            });
        }

        errorCount = this.parseSpecialReporting(log, diags, errorCount,
            EnvironmentConfig.TacticsReportStart, EnvironmentConfig.TacticsReportEnd, this.parseTacticReport);
        result.tacticsEnabled = this.parseTacticVerificationEnabled(log);

        // tslint:disable-next-line:forin
        for (const index in lines) {
            const sourceLine: string = lines[index];
            const errors: RegExpExecArray = Verification.LogParseRegex.exec(sourceLine);
            const proofObligationLine: RegExpExecArray = Verification.NumberOfProofObligations.exec(sourceLine);

            if (errors) {
                const lineNum: number = parseInt(errors[1], 10) - 1; // 1 based
                const colNum: number = Math.max(0, parseInt(errors[2], 10) - 1); // 1 based, but 0 can appear in some cases
                const typeStr: string = errors[3];
                let msgStr: string = errors[4];

                const start: vscode.Position = vscode.Position.create(lineNum, colNum);
                const end: vscode.Position = vscode.Position.create(lineNum, Number.MAX_VALUE);
                const range: vscode.Range = vscode.Range.create(start, end);

                const severity: vscode.DiagnosticSeverity = (typeStr === Severity.Info) ?
                    vscode.DiagnosticSeverity.Information : (typeStr === Severity.Warning) ?
                        vscode.DiagnosticSeverity.Warning :
                        vscode.DiagnosticSeverity.Error;

                if (severity === vscode.DiagnosticSeverity.Error) {
                    errorCount++;
                }

                const relatedRange = this.checkForRelatedLocation(lines, index, diags, relatedLocationCounter);
                if (relatedRange) {
                    msgStr += " Related location " + relatedLocationCounter + ": Line: " +
                        (relatedRange.start.line + 1) + ", Col: " + (relatedRange.start.character + 1);
                    relatedLocationCounter++;
                }

                if (typeStr == Severity.TimedOut) {
                    msgStr += " (timed out)";
                }

                lastDiagnostic = vscode.Diagnostic.create(range, msgStr, severity);
                lastDiagnostic.source = "Dafny VSCode";

                if (!msgStr.startsWith("Selected triggers:")) {
                    diags.push(lastDiagnostic);
                }

            } else if (proofObligationLine) {
                proofObligations += parseInt(proofObligationLine[1], 10);
            }
        }

        const publishDiagnosticsParams: vscode.PublishDiagnosticsParams = { uri: req.document.uri, diagnostics: diags };
        this.notificationService.sendDiagnostics(publishDiagnosticsParams);

        result.errorCount = errorCount;
        result.proofObligations = proofObligations;
        return result;
    }

    private addCounterModel(log: string, result: VerificationResult) {
        if (log && log.indexOf(EnvironmentConfig.CounterExampleStart) > -1 && log.indexOf(EnvironmentConfig.CounterExampleEnd) > -1) {
            const startOfSymbols: number = log.indexOf(EnvironmentConfig.CounterExampleStart) +
                EnvironmentConfig.CounterExampleStart.length;
            const endOfSymbols: number = log.indexOf(EnvironmentConfig.CounterExampleEnd);
            const info: string = log.substring(startOfSymbols, endOfSymbols);
            try {
                result.counterModel = JSON.parse(info);
            } catch (exception) {
                console.error("Failure  to parse response: " + exception + ", json: " + info);
                result.counterModel = null;
            }
        }
    }

    private checkForRelatedLocation(lines: string[], index: string, diags: vscode.Diagnostic[],
                                    relatedLocationCounter: number): vscode.Range {
        const nextLine: string = lines[(parseInt(index, 10) + 1).toString()];
        const relatedLocations: RegExpExecArray = Verification.RelatedLocationRegex.exec(nextLine);

        if (relatedLocations) {
            const lineNum: number = parseInt(relatedLocations[1], 10) - 1; // 1 based
            const colNum: number = Math.max(0, parseInt(relatedLocations[2], 10) - 1); // 1 based, but 0 can appear in some cases
            let msgStr: string = relatedLocations[3];

            const start: vscode.Position = vscode.Position.create(lineNum, colNum);
            const end: vscode.Position = vscode.Position.create(lineNum, Number.MAX_VALUE);
            const range: vscode.Range = vscode.Range.create(start, end);
            msgStr = "Related location " + relatedLocationCounter + ". " + msgStr;
            diags.push(vscode.Diagnostic.create(range, msgStr, vscode.DiagnosticSeverity.Warning, undefined, "Dafny VSCode"));

            return range;
        }
    }
}
