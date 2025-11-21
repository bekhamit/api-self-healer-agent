import { PostmanService } from './src/services/postman.js';
import dotenv from 'dotenv';

dotenv.config();

async function breakRequest() {
  const postmanService = new PostmanService(process.env.POSTMAN_API_KEY!);
  const collectionId = process.env.POSTMAN_COLLECTION_ID!;
  const requestId = process.env.POSTMAN_REQUEST_ID!;

  console.log('Setting URL to BROKEN state: /post/1\n');

  const request = await postmanService.getRequest(collectionId, requestId);

  if (!request) {
    console.error('Request not found!');
    return;
  }

  // Modify the URL to the broken version
  request.request.url.raw = 'https://jsonplaceholder.typicode.com/post/1';
  request.request.url.path = ['post', '1'];

  console.log('Updating request with broken URL...');
  await postmanService.updateRequest(collectionId, requestId, request);

  console.log('\n✅ Request set to broken state!');
  console.log('URL is now: https://jsonplaceholder.typicode.com/post/1');
  console.log('\nYou can verify in Postman (may need to refresh)');
}

breakRequest().catch(console.error);
