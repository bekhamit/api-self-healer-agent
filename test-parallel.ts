import { ParallelService } from './src/services/parallel.js';
import dotenv from 'dotenv';

dotenv.config();

async function testParallel() {
  console.log('Testing Parallel AI with new beta API...\n');

  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) {
    console.error('PARALLEL_API_KEY not found');
    return;
  }

  const parallelService = new ParallelService(apiKey);

  try {
    console.log('Searching for: JSONPlaceholder API documentation\n');

    const results = await parallelService.searchDocs(
      'JSONPlaceholder API posts endpoint documentation',
      'jsonplaceholder.typicode.com'
    );

    console.log('✅ Parallel AI Search Successful!\n');
    console.log('Results:\n');
    console.log(results);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testParallel();
