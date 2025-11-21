import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testParallelRaw() {
  console.log('Testing Parallel AI raw response...\n');

  const apiKey = process.env.PARALLEL_API_KEY;

  try {
    const response = await axios.post(
      'https://api.parallel.ai/v1beta/search',
      {
        objective: 'Search for JSONPlaceholder API documentation about the posts endpoint',
        search_queries: ['jsonplaceholder', 'api', 'posts', 'endpoint'],
        max_results: 2,
        excerpts: {
          max_chars_per_result: 1000,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'parallel-beta': 'search-extract-2025-10-10',
        },
      }
    );

    console.log('✅ Success!\n');
    console.log('Response structure:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('❌ Error:', error.response?.status, error.response?.data);
  }
}

testParallelRaw();
