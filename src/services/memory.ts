import { createClient, SchemaFieldTypes, VectorAlgorithms } from 'redis';
import type { RedisClientType } from 'redis';
import { pipeline } from '@xenova/transformers';
import type { FeatureExtractionPipeline } from '@xenova/transformers';

export interface FixEntry {
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  errorResponse: any;
  fixApplied: {
    type: 'header' | 'body' | 'url' | 'validation';
    description: string;
    changes: any;
  };
  correctedRequest: any;
  timestamp: string;
}

export interface SimilarFix {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  fixApplied: {
    type: string;
    description: string;
    changes: any;
  };
  correctedRequest: any;
  score: number; // L2 distance (lower = more similar)
  timestamp: string;
}

export class MemoryService {
  private client: RedisClientType;
  private embedder: FeatureExtractionPipeline | null = null;
  private readonly indexName = 'fix_idx';
  private readonly keyPrefix = 'fix:';
  private readonly vectorDim = 768; // Xenova/all-distilroberta-v1 dimension

  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.client = createClient({ url: redisUrl });
  }

  async connect(): Promise<void> {
    console.log('[Memory] Connecting to Redis...');
    await this.client.connect();
    console.log('[Memory] Connected to Redis');

    console.log('[Memory] Loading embedding model (this may take a minute on first run)...');
    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-distilroberta-v1'
    );
    console.log('[Memory] Embedding model loaded');

    await this.ensureIndexExists();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  private async ensureIndexExists(): Promise<void> {
    try {
      // Check if index already exists
      await this.client.ft.info(this.indexName);
      console.log('[Memory] Index already exists');
    } catch (error) {
      // Index doesn't exist, create it
      console.log('[Memory] Creating vector search index...');
      await this.createIndex();
      console.log('[Memory] Index created successfully');
    }
  }

  private async createIndex(): Promise<void> {
    await this.client.ft.create(
      this.indexName,
      {
        endpoint: {
          type: SchemaFieldTypes.TEXT,
          SORTABLE: true,
        },
        method: {
          type: SchemaFieldTypes.TAG,
        },
        statusCode: {
          type: SchemaFieldTypes.NUMERIC,
        },
        errorMessage: {
          type: SchemaFieldTypes.TEXT,
        },
        fixDescription: {
          type: SchemaFieldTypes.TEXT,
        },
        fixType: {
          type: SchemaFieldTypes.TAG,
        },
        correctedRequest: {
          type: SchemaFieldTypes.TEXT,
        },
        timestamp: {
          type: SchemaFieldTypes.TEXT,
        },
        embedding: {
          type: SchemaFieldTypes.VECTOR,
          TYPE: 'FLOAT32',
          ALGORITHM: VectorAlgorithms.HNSW,
          DIM: this.vectorDim,
          DISTANCE_METRIC: 'L2',
          INITIAL_CAP: 100,
          M: 16,
          EF_CONSTRUCTION: 200,
          EF_RUNTIME: 10,
        },
      },
      {
        ON: 'HASH',
        PREFIX: this.keyPrefix,
      }
    );
  }

  private async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    const result = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to Float32Array if needed
    const data = result.data;
    if (data instanceof Float32Array) {
      return data;
    }
    // Handle array-like data
    return new Float32Array(Array.from(data as any));
  }

  private buildSearchText(
    endpoint: string,
    statusCode: number,
    errorMessage: string
  ): string {
    // Combine relevant fields for semantic search
    return `${endpoint} ${statusCode} ${errorMessage}`;
  }

  async storeFix(entry: FixEntry): Promise<void> {
    console.log('[Memory] Storing fix pattern...');
    console.log(`[Memory] Endpoint: ${entry.endpoint}`);
    console.log(`[Memory] Error: ${entry.statusCode} - ${entry.errorMessage}`);

    const searchText = this.buildSearchText(
      entry.endpoint,
      entry.statusCode,
      entry.errorMessage
    );

    const embedding = await this.generateEmbedding(searchText);
    const key = `${this.keyPrefix}${Date.now()}`;

    await this.client.hSet(key, {
      endpoint: entry.endpoint,
      method: entry.method,
      statusCode: entry.statusCode.toString(),
      errorMessage: entry.errorMessage,
      fixDescription: entry.fixApplied.description,
      fixType: entry.fixApplied.type,
      fixChanges: JSON.stringify(entry.fixApplied.changes),
      correctedRequest: JSON.stringify(entry.correctedRequest),
      timestamp: entry.timestamp,
      embedding: Buffer.from(embedding.buffer),
    });

    console.log('[Memory] Fix stored successfully');
  }

  async findSimilarFixes(
    endpoint: string,
    errorMessage: string,
    statusCode: number,
    k: number = 3,
    maxDistance: number = 0.5
  ): Promise<SimilarFix[]> {
    console.log('[Memory] Searching for similar fixes...');
    console.log(`[Memory] Query: ${endpoint} ${statusCode} ${errorMessage}`);

    const searchText = this.buildSearchText(endpoint, statusCode, errorMessage);
    const queryEmbedding = await this.generateEmbedding(searchText);

    try {
      const results = await this.client.ft.search(
        this.indexName,
        `*=>[KNN ${k} @embedding $BLOB AS score]`,
        {
          PARAMS: {
            BLOB: Buffer.from(queryEmbedding.buffer),
          },
          RETURN: [
            'score',
            'endpoint',
            'method',
            'statusCode',
            'errorMessage',
            'fixDescription',
            'fixType',
            'fixChanges',
            'correctedRequest',
            'timestamp',
          ],
          DIALECT: 2,
        }
      );

      console.log(`[Memory] Found ${results.total} similar fixes`);

      const similarFixes: SimilarFix[] = [];

      for (const doc of results.documents) {
        const score = parseFloat(doc.value.score as string);

        // Only return fixes within the distance threshold
        if (score <= maxDistance) {
          similarFixes.push({
            id: doc.id,
            endpoint: doc.value.endpoint as string,
            method: doc.value.method as string,
            statusCode: parseInt(doc.value.statusCode as string),
            errorMessage: doc.value.errorMessage as string,
            fixApplied: {
              type: doc.value.fixType as string,
              description: doc.value.fixDescription as string,
              changes: JSON.parse(doc.value.fixChanges as string),
            },
            correctedRequest: JSON.parse(doc.value.correctedRequest as string),
            score,
            timestamp: doc.value.timestamp as string,
          });

          console.log(
            `[Memory] Match: ${doc.value.endpoint} (score: ${score.toFixed(4)})`
          );
        }
      }

      if (similarFixes.length === 0) {
        console.log('[Memory] No similar fixes found within threshold');
      }

      return similarFixes;
    } catch (error) {
      console.error('[Memory] Error searching for similar fixes:', error);
      return [];
    }
  }

  async getStoredFixCount(): Promise<number> {
    try {
      const info = await this.client.ft.info(this.indexName);
      // @ts-ignore - Redis returns info as object
      return parseInt(info.numDocs || '0');
    } catch (error) {
      return 0;
    }
  }
}
