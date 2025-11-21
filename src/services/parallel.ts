import axios, { AxiosInstance } from 'axios';

export interface ParallelSearchResult {
  text: string;
  url: string;
  score: number;
}

export interface ParallelSearchResponse {
  results: ParallelSearchResult[];
  query: string;
}

export class ParallelService {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.parallel.ai/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async searchDocs(query: string, apiBaseUrl?: string): Promise<string> {
    try {
      // Search for API documentation
      const response = await this.client.post('/search', {
        query: query,
        top_k: 5,
        filters: apiBaseUrl ? { url_pattern: apiBaseUrl } : undefined,
      });

      const results = response.data.results || [];

      if (results.length === 0) {
        return 'No documentation found for this query.';
      }

      // Format results into readable text
      const formattedResults = results
        .map((result: ParallelSearchResult, index: number) => {
          return `[${index + 1}] ${result.text}\nSource: ${result.url}\nRelevance: ${result.score.toFixed(2)}`;
        })
        .join('\n\n---\n\n');

      return formattedResults;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Parallel AI search failed: ${error.message}`);
      }
      throw error;
    }
  }

  async searchApiFormat(apiEndpoint: string, errorMessage: string): Promise<string> {
    const query = `
      API endpoint: ${apiEndpoint}
      Error: ${errorMessage}

      What is the correct format for the request headers and body for this endpoint?
      Include required fields, data types, and any authentication requirements.
    `;

    return this.searchDocs(query);
  }
}
