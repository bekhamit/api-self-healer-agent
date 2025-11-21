import axios, { AxiosInstance } from 'axios';

export interface ParallelSearchResult {
  excerpts: string[];
  url: string;
  title?: string;
  publish_date?: string;
}

export interface ParallelSearchResponse {
  results: ParallelSearchResult[];
}

export class ParallelService {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.parallel.ai/v1beta',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'parallel-beta': 'search-extract-2025-10-10',
      },
    });
  }

  async searchDocs(query: string, apiBaseUrl?: string): Promise<string> {
    try {
      // Construct search queries from the main query
      const searchQueries = this.extractKeywords(query);

      // Build objective with context about API documentation
      let objective = `Search for API documentation and technical information about: ${query}`;
      if (apiBaseUrl) {
        objective += ` Prefer results from ${apiBaseUrl} and official documentation.`;
      }

      // Search for API documentation using beta API
      const response = await this.client.post('/search', {
        objective: objective,
        search_queries: searchQueries,
        max_results: 5,
        excerpts: {
          max_chars_per_result: 5000,
        },
      });

      const results = response.data.results || [];

      if (results.length === 0) {
        return 'No documentation found for this query.';
      }

      // Format results into readable text
      const formattedResults = results
        .map((result: ParallelSearchResult, index: number) => {
          const title = result.title ? `${result.title}\n` : '';
          const excerpts = result.excerpts.join('\n\n');
          return `[${index + 1}] ${title}${excerpts}\nSource: ${result.url}`;
        })
        .join('\n\n---\n\n');

      return formattedResults;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        throw new Error(`Parallel AI search failed: ${errorDetails}`);
      }
      throw error;
    }
  }

  private extractKeywords(query: string): string[] {
    // Extract key terms from the query for better search results
    // Remove common words and focus on technical terms
    const commonWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'which', 'for', 'to', 'of', 'in', 'on', 'at', 'with', 'from']);

    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));

    // Return unique keywords, limit to 5 most relevant
    return [...new Set(words)].slice(0, 5);
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
