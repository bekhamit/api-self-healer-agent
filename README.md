# API Self-Healing Agent

An AI-powered agent that automatically repairs broken API calls in Postman collections. The agent uses Claude to intelligently diagnose format errors, search API documentation via Parallel AI, and iteratively fix requests until they succeed.

## Architecture

This is an **AI Agent** where Claude acts as the intelligent decision-maker:

- **Claude (AI Agent)**: Analyzes errors, interprets documentation, and decides how to fix requests
- **Tools**: Custom tools that Claude uses to interact with Postman, execute requests, and search docs
- **Workflow**: Autonomous iteration until the request succeeds or max attempts are reached

### Components

1. **Postman Integration** (`src/services/postman.ts`): Fetches and updates requests in Postman collections
2. **Parallel AI Integration** (`src/services/parallel.ts`): Searches API documentation
3. **HTTP Executor** (`src/services/httpExecutor.ts`): Executes API requests and analyzes responses
4. **Agent Tools** (`src/tools/agentTools.ts`): Tool definitions and implementations for Claude
5. **AI Agent** (`src/agent.ts`): Claude-powered agent that orchestrates the healing process

## How It Works

1. **Fetch**: Agent retrieves the broken request from Postman
2. **Execute**: Agent sends the request to the target API
3. **Analyze**: If it fails with a format error (400/422), agent analyzes the error
4. **Search**: Agent queries Parallel AI to understand the correct request format
5. **Fix**: Agent rewrites the headers and body based on documentation
6. **Retry**: Agent tests the fixed request
7. **Update**: Once successful, agent saves the corrected request to Postman

## Setup

### Prerequisites

- Node.js 18+ and npm
- API keys for:
  - Anthropic (Claude)
  - Postman
  - Parallel AI

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd api-self-healer-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your API keys:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   POSTMAN_API_KEY=your_postman_api_key
   PARALLEL_API_KEY=your_parallel_api_key
   POSTMAN_COLLECTION_ID=your_collection_id
   POSTMAN_REQUEST_ID=your_request_id
   ```

### Getting API Keys

#### Anthropic (Claude)
1. Go to https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to API Keys and create a new key

#### Postman
1. Go to https://postman.co/
2. Sign in to your account
3. Go to Settings → API Keys
4. Generate a new API key

#### Parallel AI
1. Go to https://parallel.ai/
2. Create an account
3. Navigate to API settings and generate an API key

## Demo Setup

### 1. Create a Test Collection in Postman

1. Open Postman
2. Create a new collection named "API Self-Healing Demo"
3. Add a POST request to JSONPlaceholder API:
   - URL: `https://jsonplaceholder.typicode.com/posts`
   - Method: POST
   - Headers:
     ```
     Content-Type: application/json
     ```
   - Body (intentionally broken):
     ```json
     {
       "wrong_field": "This should be 'title'",
       "another_wrong": "This should be 'body'",
       "userId": "not_a_number"
     }
     ```

4. Save the request

### 2. Get Collection and Request IDs

1. In Postman, right-click on your collection → "Share" → "Via API"
2. Copy the collection ID from the URL
3. Right-click on your request → "Copy Link"
4. Extract the request ID from the URL

### 3. Configure the Agent

Add the IDs to your `.env` file:
```
POSTMAN_COLLECTION_ID=your_collection_id_here
POSTMAN_REQUEST_ID=your_request_id_here
```

### 4. Run the Agent

```bash
npm run dev
```

The agent will:
1. Fetch your broken request
2. Execute it and detect the format error
3. Search the JSONPlaceholder API docs
4. Fix the field names and data types
5. Retry until successful
6. Update your Postman collection

### 5. Verify the Fix

1. Go back to Postman
2. Refresh your collection
3. Open the same request
4. Click "Send"
5. You should now see a successful response!

## Usage

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Configuration

All configuration is done via environment variables in `.env`:

- `ANTHROPIC_API_KEY`: Your Claude API key (required)
- `POSTMAN_API_KEY`: Your Postman API key (required)
- `PARALLEL_API_KEY`: Your Parallel AI API key (required)
- `POSTMAN_COLLECTION_ID`: Target collection ID (required)
- `POSTMAN_REQUEST_ID`: Target request ID (required)

## Limitations

- Currently only handles format errors (400/422 status codes)
- Does not fix authentication errors
- Does not modify HTTP method or URL
- Maximum of 10 iterations per healing attempt
- Only updates headers and body fields

## Future Enhancements

- Support for authentication error handling
- Multiple request healing in batch
- Custom error type handling
- Web UI for easier configuration
- Support for more API documentation sources

## License

MIT
