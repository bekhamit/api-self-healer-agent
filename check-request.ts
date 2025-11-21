import { PostmanService } from './src/services/postman.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkRequest() {
  const postmanService = new PostmanService(process.env.POSTMAN_API_KEY!);
  const collectionId = process.env.POSTMAN_COLLECTION_ID!;
  const requestId = process.env.POSTMAN_REQUEST_ID!;

  console.log('Fetching request from Postman API...\n');

  const request = await postmanService.getRequest(collectionId, requestId);

  console.log('Full request object:');
  console.log(JSON.stringify(request, null, 2));

  if (request?.request?.url) {
    console.log('\n\nURL Details:');
    console.log('Raw URL:', request.request.url.raw || request.request.url);
    console.log('Path:', request.request.url.path);
  }
}

checkRequest().catch(console.error);
