/**
 * AG-UI (Agent-User Interaction) Protocol Definitions & CopilotKit Bridge
 * =====================================================================
 * Official protocol standard created by CopilotKit for connecting AI agent
 * backends (such as Agno) to frontend client applications over event streams.
 */

export type AGUIEventType =
    // Lifecycle
    | 'RUN_STARTED'
    | 'RUN_FINISHED'
    | 'RUN_ERROR'
    // Steps
    | 'STEP_STARTED'
    | 'STEP_FINISHED'
    // Reasoning / Thinking
    | 'REASONING_START'
    | 'REASONING_MESSAGE_CONTENT'
    | 'REASONING_END'
    // Tool Calls
    | 'TOOL_CALL_START'
    | 'TOOL_CALL_ARGS'
    | 'TOOL_CALL_END'
    | 'TOOL_CALL_RESULT'
    // Text Messages
    | 'TEXT_MESSAGE_START'
    | 'TEXT_MESSAGE_CONTENT'
    | 'TEXT_MESSAGE_END'
    // State Synchronization
    | 'STATE_SNAPSHOT'
    | 'STATE_DELTA'
    // Extensions
    | 'CUSTOM';

export interface AGUIEventPayload {
    type: AGUIEventType | string;
    runId?: string;
    timestamp?: number;
    [key: string]: any;
}

export interface AGUIPipelineStep {
    stepId: string;
    stepName: string;
    status: 'running' | 'completed' | 'error';
    details?: string;
    durationMs?: number;
    elapsed_ms?: number;
}

export interface AGUIToolCall {
    toolCallId?: string;
    tool: string;
    label?: string;
    status: 'running' | 'completed' | 'error';
    detail?: string;
    count?: number;
    durationMs?: number;
}

export interface AGUIReasoningStep {
    signature: string;
    content: string;
    timestamp?: number;
}

export interface AGUICitationClassification {
    index: number;
    source_id: string;
    source_title?: string;
    semantic_type: 'supported' | 'contrasting' | 'mentioning';
    confidence?: number;
    quote?: string;
}

/**
 * CopilotKit Bridge Adapter:
 * Validates and exposes AG-UI agent state to CopilotKit consumers.
 */
export class CopilotKitAGUIBridge {
    static isAGUIEvent(data: any): boolean {
        return Boolean(
            data &&
            typeof data === 'object' &&
            typeof data.type === 'string' &&
            (data.type === data.type.toUpperCase() || Boolean(data.runId))
        );
    }

    static normalizeStep(raw: any): AGUIPipelineStep {
        return {
            stepId: raw.stepId || raw.id || 'step_unknown',
            stepName: raw.stepName || raw.label || 'Executing Step',
            status: raw.status || 'completed',
            details: raw.details || raw.detail,
            durationMs: raw.durationMs || raw.elapsed_ms || 0,
            elapsed_ms: raw.elapsed_ms || raw.durationMs || 0,
        };
    }
}
