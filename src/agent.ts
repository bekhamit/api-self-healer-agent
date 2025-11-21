import Anthropic from '@anthropic-ai/sdk';
import { AgentTools, toolDefinitions } from './tools/agentTools.js';

const SYSTEM_PROMPT = `You are an API Self-Healing Agent with learning capabilities. Your job is to automatically repair broken API requests in Postman collections, and you learn from past fixes to improve over time.

Your workflow:
1. Fetch the broken request from Postman using the collection_id and request_id
2. CHECK MEMORY FIRST using check_memory tool with the endpoint URL
   - If a similar fix is found (similarity score < 0.5), apply the cached fix immediately
   - If no match found or score too high, proceed to execute the original request
3. Execute the request against the target API
4. If it fails with an error (400, 404, 422 status codes):
   - IMMEDIATELY search the API documentation using Parallel AI - do this FIRST before attempting any fixes
   - Analyze the error response along with the documentation to understand what's wrong
   - Fix the request based on the documentation (headers, body, or URL path if needed)
   - Retry the request with the corrected format
5. Repeat step 4 until the request succeeds
6. Once successful, update the Postman collection with the corrected request
7. IMPORTANT: After updating Postman, store the fix in memory using store_fix tool
8. After storing the fix, explicitly state "Task completed successfully" to signal completion

Important rules:
- Fix format-related errors (malformed data, incorrect fields, validation errors, wrong endpoints)
- You CAN fix URL path format errors (e.g., /post vs /posts) but preserve the base URL and domain
- Do NOT modify the HTTP method (GET, POST, etc.)
- Do NOT fix authentication errors (401, 403) or server errors (500+)
- Be methodical: analyze the error, search docs, make targeted fixes
- Always explain what you're doing and why

Efficiency guidelines:
- ALWAYS search documentation FIRST when you get an error - don't waste iterations guessing
- Never retry identical requests without making changes based on documentation
- Only use update_postman_request after confirming the request works (status code 200-299)
- Documentation lookups are cheaper than trial-and-error - use them proactively

You have access to these tools:
- check_memory: Search for similar past errors and cached fixes (use FIRST after fetching)
- fetch_postman_request: Get a request from Postman
- execute_api_request: Execute an HTTP request
- search_api_docs: Search API documentation via Parallel AI
- update_postman_request: Save the fixed request back to Postman
- store_fix: Store successful fixes in memory for future learning (use AFTER updating Postman)`;

export class ApiSelfHealingAgent {
  private client: Anthropic;
  private tools: AgentTools;
  private maxIterations: number;
  private model: string;

  constructor(
    anthropicApiKey: string,
    tools: AgentTools,
    model: string = 'claude-3-5-sonnet-20241022',
    maxIterations: number = 20
  ) {
    this.client = new Anthropic({ apiKey: anthropicApiKey });
    this.tools = tools;
    this.model = model;
    this.maxIterations = maxIterations;
  }

  async heal(collectionId: string, requestId: string): Promise<string> {
    console.log('\n🤖 Starting API Self-Healing Agent...\n');

    const initialPrompt = `Please fix the broken API request in Postman collection "${collectionId}", request ID "${requestId}".

Follow your workflow to:
1. Fetch the request
2. Check memory for similar past fixes
3. If cached fix found, apply it; otherwise execute to see what's wrong
4. If it's a format error, search the docs and fix it
5. Keep trying until it works
6. Update Postman with the corrected version
7. Store the fix in memory for future learning
8. Signal completion when done

Begin now.`;

    let messages: Anthropic.MessageParam[] = [
      { role: 'user', content: initialPrompt },
    ];

    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`\n--- Iteration ${iteration} ---\n`);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools: toolDefinitions,
      });

      console.log(`Assistant: ${this.extractTextContent(response.content)}\n`);

      if (response.stop_reason === 'end_turn') {
        console.log('\n✅ Agent completed successfully!\n');
        return this.extractTextContent(response.content);
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.MessageParam = {
          role: 'user',
          content: [],
        };

        let lastToolName = '';
        let lastToolResult: any = null;

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            console.log(`🔧 Using tool: ${block.name}`);
            console.log(`   Input: ${JSON.stringify(block.input, null, 2)}\n`);

            const result = await this.tools.executeTool(block.name, block.input);

            console.log(`   Result: ${typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)}...\n`);

            lastToolName = block.name;
            lastToolResult = result;

            (toolResults.content as any[]).push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: typeof result === 'string' ? result : JSON.stringify(result),
            });
          }
        }

        // Check if we just successfully updated Postman - if so, task is complete
        if (lastToolName === 'update_postman_request') {
          const resultObj = typeof lastToolResult === 'string'
            ? JSON.parse(lastToolResult)
            : lastToolResult;

          if (resultObj.success === true) {
            console.log('\n✅ Agent completed successfully! Postman collection has been updated.\n');
            return 'Task completed successfully. The API request has been fixed and updated in Postman.';
          }
        }

        messages.push(
          { role: 'assistant', content: response.content },
          toolResults
        );
      } else {
        break;
      }
    }

    if (iteration >= this.maxIterations) {
      console.log('\n⚠️  Max iterations reached. Agent did not complete.\n');
      return 'Max iterations reached. Could not complete the task.';
    }

    return 'Agent stopped unexpectedly.';
  }

  private extractTextContent(content: Anthropic.ContentBlock[]): string {
    return content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');
  }
}
