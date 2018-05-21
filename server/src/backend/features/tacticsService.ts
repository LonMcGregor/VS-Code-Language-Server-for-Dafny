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
        let result: TacticExpansionResult[] = [];
        const docUri = context.activeRequest.document.uri.toString();
        if(log && log.indexOf(EnvironmentConfig.DafnySuccess) > 0 && log.indexOf(EnvironmentConfig.ExpandedTacticStart) > -1) {
            const startOfReport: number = log.indexOf(EnvironmentConfig.ExpandedTacticStart) + EnvironmentConfig.ExpandedTacticStart.length;
            const endOfReport: number = log.indexOf(EnvironmentConfig.ExpandedTacticEnd);
            const jsonstring: string = log.substring(startOfReport, endOfReport);
            const info = JSON.parse(jsonstring);
            if(info.length){
                result = this.handleProcessList(info);
            } else {
                result = [this.handleProcessSingle(info)];
            }
        }
        notificationService.sendTacticsExpansionResult([docUri, JSON.stringify(result)], isEdit);
    }

    /**
     * Process expansions coming in from the dafny server
     * @param info The list of expansions from the server
     */
    private handleProcessList(info): TacticExpansionResult[]{
        if(info[0].status !== "SUCCESS"){
            const result = new TacticExpansionResult();
            switch(info[0].status){
                case "NO_TACTIC":
                    result.status = TacticExpanionStatus.NoTactic;
                    break;
                case "UNRESOLVED":
                    result.status = TacticExpanionStatus.Unresolved;
                    break;
            }
            return [result];
        }
        const resultList: TacticExpansionResult[] = [];
        info.forEach(expansion => {
            resultList.push(this.handleProcessSingle(expansion));
        });
        return resultList;
    }

    /**
     * Handle a single expansion from the server
     * @param info A single expansion coming from th eserver
     */
    private handleProcessSingle(info): TacticExpansionResult{
        const result = new TacticExpansionResult();
        switch(info.status){
            case "SUCCESS":
                result.status = TacticExpanionStatus.Success;
                result.expansion = info.expansion;
                result.startPosition = info.startPos;
                result.endPosition = info.endPos;
                break;
            case "NO_TACTIC":
                result.status = TacticExpanionStatus.NoTactic;
                break;
            case "UNRESOLVED":
                result.status = TacticExpanionStatus.Unresolved;
                break;
        }
        return result;
    }
}
