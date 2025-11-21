import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testParallelAPI() {
  console.log('Testing Parallel AI API...\n');
  const apiKey = process.env.PARALLEL_API_KEY;
  console.log(`API Key: ${apiKey?.substring(0, 10)}...`);

  try {
    const response = await axios.post(
      'https://api.parallel.ai/v1/search',
      {
        query: 'test query',
        top_k: 3,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ Parallel AI works!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('❌ Parallel AI Error:', error.response?.status, error.response?.data);
  }
}

async function testPostmanAPI() {
  console.log('\n\nTesting Postman API...\n');
  const apiKey = process.env.POSTMAN_API_KEY;
  const collectionId = process.env.POSTMAN_COLLECTION_ID;

  try {
    const response = await axios.get(
      `https://api.getpostman.com/collections/${collectionId}`,
      {
        headers: {
          'X-Api-Key': apiKey,
        },
      }
    );
    console.log('✅ Postman API works!');
    console.log('Collection name:', response.data.collection.info.name);
    console.log('Number of items:', response.data.collection.item.length);
  } catch (error: any) {
    console.error('❌ Postman API Error:', error.response?.status, error.response?.data);
  }
}

async function main() {
  await testParallelAPI();
  await testPostmanAPI();
}

main();
