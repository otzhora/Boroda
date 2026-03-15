import type { FastifyInstance } from "fastify";
import { toErrorPayload } from "../../../shared/errors";
import { mcpToolDefinitions } from "./tools";

const JSON_RPC_VERSION = "2.0";
const MCP_PROTOCOL_VERSION = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
}

function success(id: JsonRpcResponse["id"], result: Record<string, unknown>): JsonRpcResponse {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result
  };
}

function failure(
  id: JsonRpcResponse["id"],
  code: number,
  message: string,
  data?: Record<string, unknown>
): JsonRpcResponse {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {})
    }
  };
}

function formatToolResult(result: unknown, isError = false) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ],
    structuredContent: result,
    isError
  };
}

export async function handleMcpRequest(
  app: FastifyInstance,
  request: JsonRpcRequest
): Promise<JsonRpcResponse | null> {
  if (request.jsonrpc !== JSON_RPC_VERSION) {
    return failure(request.id ?? null, -32600, "Invalid Request");
  }

  switch (request.method) {
    case "notifications/initialized":
      return null;
    case "initialize":
      return success(request.id ?? null, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "boroda",
          version: "0.1.0"
        }
      });
    case "tools/list":
      return success(request.id ?? null, {
        tools: mcpToolDefinitions.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      });
    case "tools/call": {
      const name = typeof request.params?.name === "string" ? request.params.name : null;
      const tool = mcpToolDefinitions.find((candidate) => candidate.name === name);

      if (!tool) {
        return success(request.id ?? null, formatToolResult({
          error: {
            code: "TOOL_NOT_FOUND",
            message: "Unknown MCP tool"
          }
        }, true));
      }

      try {
        const args = tool.schema.parse(request.params?.arguments ?? {});
        const result = await tool.handler(app, args);
        return success(request.id ?? null, formatToolResult(result));
      } catch (error) {
        const { payload } = toErrorPayload(error);
        return success(request.id ?? null, formatToolResult(payload, true));
      }
    }
    default:
      return failure(request.id ?? null, -32601, "Method not found");
  }
}
