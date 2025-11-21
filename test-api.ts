import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function testApi() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log('Testing Anthropic API...\n');
  console.log(`API Key: ${apiKey?.substring(0, 20)}...`);

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello!' }],
    });

    console.log('\n✅ API key is valid!');
    console.log('Response:', response.content);
  } catch (error: any) {
    console.error('\n❌ API Error:', error.message);
    if (error.status) {
      console.error(`Status: ${error.status}`);
    }
  }
}

testApi();
