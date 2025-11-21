import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { PostmanRequest } from './postman.js';

export interface ExecutionResult {
  success: boolean;
  statusCode: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  error?: string;
  isFormatError: boolean;
}

export class HttpExecutor {
  async executePostmanRequest(postmanRequest: PostmanRequest): Promise<ExecutionResult> {
    try {
      const config = this.convertPostmanToAxios(postmanRequest);
      const response = await axios(config);

      return {
        success: true,
        statusCode: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers as Record<string, string>,
        isFormatError: false,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status || 0;
        const isFormatError = this.isFormatError(statusCode, axiosError);

        return {
          success: false,
          statusCode,
          statusText: axiosError.response?.statusText || 'Unknown Error',
          data: axiosError.response?.data,
          headers: (axiosError.response?.headers as Record<string, string>) || {},
          error: axiosError.message,
          isFormatError,
        };
      }

      return {
        success: false,
        statusCode: 0,
        statusText: 'Unknown Error',
        data: null,
        headers: {},
        error: error instanceof Error ? error.message : String(error),
        isFormatError: false,
      };
    }
  }

  private convertPostmanToAxios(postmanRequest: PostmanRequest): AxiosRequestConfig {
    const url = this.buildUrl(postmanRequest.request.url);
    const headers: Record<string, string> = {};

    if (postmanRequest.request.header) {
      postmanRequest.request.header.forEach((h) => {
        headers[h.key] = h.value;
      });
    }

    let data: any = undefined;
    if (postmanRequest.request.body) {
      if (postmanRequest.request.body.mode === 'raw') {
        data = postmanRequest.request.body.raw;
        try {
          data = JSON.parse(data);
        } catch {
          // Keep as string if not JSON
        }
      } else if (postmanRequest.request.body.mode === 'urlencoded') {
        data = postmanRequest.request.body.urlencoded;
      } else if (postmanRequest.request.body.mode === 'formdata') {
        data = postmanRequest.request.body.formdata;
      }
    }

    return {
      method: postmanRequest.request.method,
      url,
      headers,
      data,
      validateStatus: () => true, // Don't throw on any status
    };
  }

  private buildUrl(url: any): string {
    if (typeof url === 'string') {
      return url;
    }

    if (url.raw) {
      return url.raw;
    }

    const protocol = url.protocol || 'https';
    const host = Array.isArray(url.host) ? url.host.join('.') : url.host;
    const path = Array.isArray(url.path) ? url.path.join('/') : url.path;
    let fullUrl = `${protocol}://${host}/${path}`;

    if (url.query && url.query.length > 0) {
      const queryString = url.query
        .map((q: any) => `${q.key}=${q.value}`)
        .join('&');
      fullUrl += `?${queryString}`;
    }

    return fullUrl;
  }

  private isFormatError(statusCode: number, error: AxiosError): boolean {
    // Format errors are typically 400 Bad Request or 422 Unprocessable Entity
    if (statusCode === 400 || statusCode === 422) {
      return true;
    }

    // Check error message for format-related keywords
    const errorMessage = error.message.toLowerCase();
    const formatKeywords = [
      'invalid',
      'malformed',
      'format',
      'syntax',
      'parse',
      'validation',
      'schema',
    ];

    return formatKeywords.some((keyword) => errorMessage.includes(keyword));
  }
}
