"use strict";
import { TextDocument } from "vscode-languageserver";
import { DafnyServer } from "../dafnyServer";
import { DafnyVerbs, EnvironmentConfig } from "./../../strings/stringRessources";
import { NotificationService } from "../../notificationService";
import { decodeBase64String } from "../../strings/stringEncoding";
import { Context } from "../context";

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
 * Class that deals with interactions relating to tactics
 */
export class TacticsService {
    constructor(public server: DafnyServer){ }

    /**
     * Handle the output of a request to expand tactics
     * @param log The log returned from Dafnyserver.exe
     * @param notificationService for sending response back
     * @param context The context of the request
     * @param isEdit if the requets was for an edit or preview
     */
    public handleProcessData(log: string, notificationService: NotificationService, context: Context, isEdit: boolean): void {
        const result = new TacticExpansionResult();
        if(log && log.indexOf(EnvironmentConfig.DafnySuccess) > 0 && log.indexOf(EnvironmentConfig.ExpandedTacticStart) > -1) {
            const startOfReport: number = log.indexOf(EnvironmentConfig.ExpandedTacticStart) + EnvironmentConfig.ExpandedTacticStart.length;
            const endOfReport: number = log.indexOf(EnvironmentConfig.ExpandedTacticEnd);
            const jsonstring: string = log.substring(startOfReport, endOfReport);
            const info = JSON.parse(jsonstring);
            switch(info.status){
                case "SUCCESS":
                    result.status = TacticExpanionStatus.Success;
                    result.expansion = decodeBase64String(info.expansion64);
                    result.startPosition = info.startPos;
                    result.endPosition = info.endPos;
                    break;
                case "NO_TACTIC":
                    result.status = TacticExpanionStatus.NoTactic;
                    break;
                case "TRANSLATOR_FAIL":
                    result.status = TacticExpanionStatus.TranslationFail;
                    break;
                case "UNRESOLVED":
                    result.status = TacticExpanionStatus.Unresolved;
                    break;
            }
        }
        notificationService.sendTacticsExpansionResult([context.activeRequest.document.uri.toString(), JSON.stringify(result)], isEdit);
    }

    /**
     * The request failed. Respond based on this.
     * @param response output from DafnyServer.exe
     * @param notificationService for sending response back
     * @param context The context of the request
     */
    public handleError(response: string, notificationService: NotificationService, context: Context): void {
        const result = new TacticExpansionResult();
        result.status = TacticExpanionStatus.TranslationFail;
        notificationService.sendTacticsExpansionResult([context.activeRequest.document.uri.toString(), JSON.stringify(result)], false);
    }
}
