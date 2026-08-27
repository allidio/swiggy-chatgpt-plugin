import { z } from "zod";
export type ToolStage = "discover" | "cart" | "order" | "track" | "support";
export interface ToolDefinition {
    name: string;
    title: string;
    stage: ToolStage;
    description: string;
    inputSchema: z.ZodRawShape;
    outputSchema?: z.ZodRawShape;
    readOnly: boolean;
    destructive?: boolean;
    requiresConfirmation?: boolean;
}
export declare const genericOutputSchema: Readonly<{
    [k: string]: z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>;
}>;
export declare const instamartTools: ToolDefinition[];
export declare function getLocalToolDefinition(name: string): ToolDefinition | undefined;
