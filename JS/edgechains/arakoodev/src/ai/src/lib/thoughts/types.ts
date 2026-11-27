export interface ThoughtNode {
    id: string;
    parentId?: string;
    depth: number;
    thought: string;
    score: number;
    visits?: number;
    children: ThoughtNode[];
    isTerminal?: boolean;
    metadata?: Record<string, any>;
}

export interface ThoughtStep {
    stepNumber: number;
    thought: string;
    rationale?: string;
    subConfidence?: number;
}

export interface ThoughtResult {
    query: string;
    finalAnswer: string;
    trace: string[];
    steps: ThoughtStep[];
    bestScore: number;
    totalThoughtsEvaluated: number;
    tree?: ThoughtNode;
}

export type ThoughtGeneratorFn = (prompt: string, context?: string, currentDepth?: number) => Promise<string[] | string>;
export type ThoughtEvaluatorFn = (thought: string, context?: string, query?: string) => Promise<number> | number;

export interface EoTOptions {
    maxDepth?: number;
    beamWidth?: number;
    branchingFactor?: number;
    temperature?: number;
    verbose?: boolean;
    thoughtGenerator?: ThoughtGeneratorFn;
    thoughtEvaluator?: ThoughtEvaluatorFn;
}

export interface CoTOptions {
    maxSteps?: number;
    verbose?: boolean;
    thoughtGenerator?: ThoughtGeneratorFn;
    thoughtEvaluator?: ThoughtEvaluatorFn;
}
