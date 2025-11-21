import dotenv from 'dotenv';
import { PostmanService } from './services/postman.js';
import { ParallelService } from './services/parallel.js';
import { HttpExecutor } from './services/httpExecutor.js';
import { MemoryService } from './services/memory.js';
import { AgentTools } from './tools/agentTools.js';
import { ApiSelfHealingAgent } from './agent.js';

dotenv.config();

async function main() {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
  const postmanApiKey = process.env.POSTMAN_API_KEY;
  const parallelApiKey = process.env.PARALLEL_API_KEY;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const collectionId = process.env.POSTMAN_COLLECTION_ID;
  const requestId = process.env.POSTMAN_REQUEST_ID;

  if (!anthropicApiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY is required');
    process.exit(1);
  }

  if (!postmanApiKey) {
    console.error('❌ Error: POSTMAN_API_KEY is required');
    process.exit(1);
  }

  if (!parallelApiKey) {
    console.error('❌ Error: PARALLEL_API_KEY is required');
    process.exit(1);
  }

  if (!collectionId || !requestId) {
    console.error('❌ Error: POSTMAN_COLLECTION_ID and POSTMAN_REQUEST_ID are required');
    process.exit(1);
  }

  console.log('🚀 API Self-Healing Agent with Learning');
  console.log('========================================\n');
  console.log(`Model: ${claudeModel}`);
  console.log(`Redis: ${redisUrl}`);
  console.log(`Collection ID: ${collectionId}`);
  console.log(`Request ID: ${requestId}\n`);

  // Initialize services
  const postmanService = new PostmanService(postmanApiKey);
  const parallelService = new ParallelService(parallelApiKey);
  const httpExecutor = new HttpExecutor();

  // Initialize and connect memory service
  const memoryService = new MemoryService(redisUrl);

  try {
    await memoryService.connect();

    const storedFixes = await memoryService.getStoredFixCount();
    console.log(`\n💾 Memory: ${storedFixes} fix(es) stored from previous runs\n`);

    const agentTools = new AgentTools(
      postmanService,
      parallelService,
      httpExecutor,
      memoryService
    );

    const agent = new ApiSelfHealingAgent(anthropicApiKey, agentTools, claudeModel);

    const result = await agent.heal(collectionId, requestId);
    console.log('\n📋 Final Result:\n');
    console.log(result);
    console.log('\n✨ Done! Check your Postman collection for the updated request.\n');

    // Show updated memory count
    const updatedFixes = await memoryService.getStoredFixCount();
    console.log(`💾 Memory now contains ${updatedFixes} fix(es)\n`);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await memoryService.disconnect();
  }
}

main();
