import { PostmanService } from '../services/postman.js';
import { ParallelService } from '../services/parallel.js';
import { HttpExecutor } from '../services/httpExecutor.js';
import { MemoryService } from '../services/memory.js';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'check_memory',
    description:
      'Search memory for similar past errors and their successful fixes. Returns cached solutions if similar errors have been fixed before. Use this AFTER fetching the request but BEFORE executing it.',
    input_schema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'The API endpoint URL that will be called',
        },
        error_message: {
          type: 'string',
          description:
            'The error message from a failed request (empty string if not yet executed)',
        },
        status_code: {
          type: 'number',
          description:
            'The HTTP status code from the error (0 if not yet executed)',
        },
      },
      required: ['endpoint'],
    },
  },
  {
    name: 'fetch_postman_request',
    description: 'Fetches a specific API request from a Postman collection by its ID. Automatically handles both standard UUID format and composite IDs with workspace prefixes.',
    input_schema: {
      type: 'object',
      properties: {
        collection_id: {
          type: 'string',
          description: 'The Postman collection ID',
        },
        request_id: {
          type: 'string',
          description: 'The specific request ID within the collection (supports both UUID and composite formats)',
        },
      },
      required: ['collection_id', 'request_id'],
    },
  },
  {
    name: 'execute_api_request',
    description:
      'Executes an HTTP API request and returns the response including status code, headers, body, and error details. IMPORTANT: Pass the FULL PostmanRequest object structure including the outer wrapper. Example format: {"name":"Request Name","request":{"method":"POST","url":{"raw":"https://api.example.com/endpoint"},"header":[{"key":"Content-Type","value":"application/json"}],"body":{"mode":"raw","raw":"{\\"field\\":\\"value\\"}"}}}',
    input_schema: {
      type: 'object',
      properties: {
        request_json: {
          type: 'string',
          description: 'JSON string of the complete Postman request object. Must include the outer wrapper with "request" property containing url, method, header, and body fields.',
        },
      },
      required: ['request_json'],
    },
  },
  {
    name: 'search_api_docs',
    description:
      'Searches API documentation using Parallel AI to find information about correct request formats, required fields, and error solutions',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query describing what you need to know about the API (e.g., "correct format for POST /users endpoint")',
        },
        api_endpoint: {
          type: 'string',
          description: 'Optional: The specific API endpoint URL to search documentation for',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_postman_request',
    description:
      'Updates a request in a Postman collection with corrected headers and body. Automatically handles both standard UUID format and composite IDs with workspace prefixes.',
    input_schema: {
      type: 'object',
      properties: {
        collection_id: {
          type: 'string',
          description: 'The Postman collection ID',
        },
        request_id: {
          type: 'string',
          description: 'The specific request ID to update (supports both UUID and composite formats)',
        },
        updated_request_json: {
          type: 'string',
          description: 'JSON string of the complete updated request object',
        },
      },
      required: ['collection_id', 'request_id', 'updated_request_json'],
    },
  },
  {
    name: 'store_fix',
    description:
      'Store a successful fix in memory for future reference. Call this AFTER successfully updating Postman with a working fix. This helps the agent learn and improve over time.',
    input_schema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'The API endpoint that was fixed',
        },
        method: {
          type: 'string',
          description: 'The HTTP method (GET, POST, etc.)',
        },
        status_code: {
          type: 'number',
          description: 'The original error status code',
        },
        error_message: {
          type: 'string',
          description: 'The original error message',
        },
        fix_description: {
          type: 'string',
          description: 'A brief description of what was fixed',
        },
        fix_type: {
          type: 'string',
          description: 'The type of fix applied: header, body, url, or validation',
        },
        corrected_request_json: {
          type: 'string',
          description: 'JSON string of the complete corrected request',
        },
      },
      required: [
        'endpoint',
        'method',
        'status_code',
        'error_message',
        'fix_description',
        'fix_type',
        'corrected_request_json',
      ],
    },
  },
];

export class AgentTools {
  constructor(
    private postmanService: PostmanService,
    private parallelService: ParallelService,
    private httpExecutor: HttpExecutor,
    private memoryService: MemoryService
  ) {}

  async executeTool(toolName: string, toolInput: any): Promise<any> {
    switch (toolName) {
      case 'check_memory':
        return this.checkMemory(
          toolInput.endpoint,
          toolInput.error_message || '',
          toolInput.status_code || 0
        );

      case 'fetch_postman_request':
        return this.fetchPostmanRequest(
          toolInput.collection_id,
          toolInput.request_id
        );

      case 'execute_api_request':
        return this.executeApiRequest(toolInput.request_json);

      case 'search_api_docs':
        return this.searchApiDocs(toolInput.query, toolInput.api_endpoint);

      case 'update_postman_request':
        return this.updatePostmanRequest(
          toolInput.collection_id,
          toolInput.request_id,
          toolInput.updated_request_json
        );

      case 'store_fix':
        return this.storeFix(
          toolInput.endpoint,
          toolInput.method,
          toolInput.status_code,
          toolInput.error_message,
          toolInput.fix_description,
          toolInput.fix_type,
          toolInput.corrected_request_json
        );

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async fetchPostmanRequest(
    collectionId: string,
    requestId: string
  ): Promise<string> {
    try {
      const request = await this.postmanService.getRequest(
        collectionId,
        requestId
      );

      if (!request) {
        return JSON.stringify({
          error: 'Request not found',
          collection_id: collectionId,
          request_id: requestId,
        });
      }

      return JSON.stringify(request, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async executeApiRequest(requestJson: string): Promise<string> {
    try {
      const request = JSON.parse(requestJson);
      const result = await this.httpExecutor.executePostmanRequest(request);

      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
    }
  }

  private async searchApiDocs(
    query: string,
    apiEndpoint?: string
  ): Promise<string> {
    try {
      const results = await this.parallelService.searchDocs(query, apiEndpoint);
      return results;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async updatePostmanRequest(
    collectionId: string,
    requestId: string,
    updatedRequestJson: string
  ): Promise<string> {
    try {
      const updatedRequest = JSON.parse(updatedRequestJson);

      await this.postmanService.updateRequest(
        collectionId,
        requestId,
        updatedRequest
      );

      return JSON.stringify({
        success: true,
        message: 'Request updated successfully',
        collection_id: collectionId,
        request_id: requestId,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
    }
  }

  private async checkMemory(
    endpoint: string,
    errorMessage: string,
    statusCode: number
  ): Promise<string> {
    try {
      const similarFixes = await this.memoryService.findSimilarFixes(
        endpoint,
        errorMessage,
        statusCode,
        3,
        0.5
      );

      if (similarFixes.length === 0) {
        return JSON.stringify({
          found: false,
          message: 'No similar fixes found in memory',
          total_stored: await this.memoryService.getStoredFixCount(),
        });
      }

      return JSON.stringify({
        found: true,
        message: `Found ${similarFixes.length} similar fix(es)`,
        fixes: similarFixes.map((fix) => ({
          endpoint: fix.endpoint,
          method: fix.method,
          original_error: {
            status_code: fix.statusCode,
            message: fix.errorMessage,
          },
          fix_applied: fix.fixApplied,
          corrected_request: fix.correctedRequest,
          similarity_score: fix.score,
          timestamp: fix.timestamp,
        })),
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        found: false,
      });
    }
  }

  private async storeFix(
    endpoint: string,
    method: string,
    statusCode: number,
    errorMessage: string,
    fixDescription: string,
    fixType: string,
    correctedRequestJson: string
  ): Promise<string> {
    try {
      const correctedRequest = JSON.parse(correctedRequestJson);

      await this.memoryService.storeFix({
        endpoint,
        method,
        statusCode,
        errorMessage,
        errorResponse: null,
        fixApplied: {
          type: fixType as 'header' | 'body' | 'url' | 'validation',
          description: fixDescription,
          changes: correctedRequest,
        },
        correctedRequest,
        timestamp: new Date().toISOString(),
      });

      const totalStored = await this.memoryService.getStoredFixCount();

      return JSON.stringify({
        success: true,
        message: 'Fix stored in memory successfully',
        total_fixes_stored: totalStored,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
    }
  }
}
