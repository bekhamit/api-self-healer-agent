import { PostmanService } from '../services/postman.js';
import { ParallelService } from '../services/parallel.js';
import { HttpExecutor } from '../services/httpExecutor.js';

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
];

export class AgentTools {
  constructor(
    private postmanService: PostmanService,
    private parallelService: ParallelService,
    private httpExecutor: HttpExecutor
  ) {}

  async executeTool(toolName: string, toolInput: any): Promise<any> {
    switch (toolName) {
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
}
