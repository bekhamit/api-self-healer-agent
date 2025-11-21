import axios, { AxiosInstance } from 'axios';

export interface PostmanRequest {
  id: string;
  name: string;
  request: {
    method: string;
    header: Array<{ key: string; value: string; type: string }>;
    body?: {
      mode: string;
      raw?: string;
      urlencoded?: Array<{ key: string; value: string }>;
      formdata?: Array<{ key: string; value: string }>;
    };
    url: {
      raw: string;
      protocol: string;
      host: string[];
      path: string[];
      query?: Array<{ key: string; value: string }>;
    };
  };
}

export interface PostmanCollection {
  collection: {
    info: {
      name: string;
      schema: string;
    };
    item: Array<{
      id: string;
      name: string;
      request: any;
    }>;
  };
}

export class PostmanService {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.getpostman.com',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async getCollection(collectionId: string): Promise<PostmanCollection> {
    const response = await this.client.get(`/collections/${collectionId}`);
    return response.data;
  }

  async getRequest(collectionId: string, requestId: string): Promise<PostmanRequest | null> {
    const collection = await this.getCollection(collectionId);

    const findRequest = (items: any[]): PostmanRequest | null => {
      for (const item of items) {
        if (item.id === requestId) {
          return item as PostmanRequest;
        }
        if (item.item && Array.isArray(item.item)) {
          const found = findRequest(item.item);
          if (found) return found;
        }
      }
      return null;
    };

    return findRequest(collection.collection.item);
  }

  async updateRequest(
    collectionId: string,
    requestId: string,
    updatedRequest: Partial<PostmanRequest>
  ): Promise<void> {
    console.log('\n[Postman Update] Starting update process...');
    console.log('[Postman Update] Collection ID:', collectionId);
    console.log('[Postman Update] Request ID:', requestId);

    const collection = await this.getCollection(collectionId);
    console.log('[Postman Update] Fetched collection:', collection.collection.info.name);

    const updateInPlace = (items: any[]): boolean => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === requestId) {
          console.log('[Postman Update] Found request to update:', items[i].name);
          console.log('[Postman Update] Current URL:', items[i].request?.url?.raw || 'N/A');
          items[i] = { ...items[i], ...updatedRequest };
          console.log('[Postman Update] New URL:', items[i].request?.url?.raw || 'N/A');
          return true;
        }
        if (items[i].item && Array.isArray(items[i].item)) {
          if (updateInPlace(items[i].item)) return true;
        }
      }
      return false;
    };

    const updated = updateInPlace(collection.collection.item);
    console.log('[Postman Update] Update in place result:', updated);

    if (!updated) {
      console.error('[Postman Update] ERROR: Request not found in collection!');
      throw new Error('Request not found in collection');
    }

    // Postman API expects just the collection object, not the wrapper
    console.log('[Postman Update] Sending PUT request to Postman API...');
    const response = await this.client.put(`/collections/${collectionId}`, {
      collection: collection.collection
    });

    console.log('[Postman Update] Response status:', response.status);
    console.log('[Postman Update] Response data:', JSON.stringify(response.data, null, 2));
    console.log('[Postman Update] Update complete!\n');
  }
}
