/**
 * Storage Activities (S3/MinIO)
 *
 * Handles object storage operations for tenant file storage using S3-compatible APIs.
 * Supports both AWS S3 and MinIO for local development.
 */

import { Context } from '@temporalio/activity';
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { createActivityTracer } from '../observability/activity-tracer';
import { ServiceUnavailableError } from '../utils/errors';

const logger = createLogger('storage-activities');

// ============================================
// S3 Client Configuration
// ============================================

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const s3Config = config.storage?.s3 || {
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin123',
      forcePathStyle: true, // Required for MinIO
    };

    logger.debug('Initializing S3 client', {
      endpoint: s3Config.endpoint,
      region: s3Config.region,
    });

    s3Client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: s3Config.forcePathStyle ?? true,
    });
  }
  return s3Client;
}

// ============================================
// Types
// ============================================

interface ProvisionStorageInput {
  tenantId: string;
  tenantKey: string;
  tier?: string;
}

interface ProvisionStorageResult {
  bucketName: string;
  endpoint: string;
  region: string;
  success: boolean;
}

interface DeprovisionStorageInput {
  tenantId: string;
  tenantKey: string;
  forceDelete?: boolean;
}

// ============================================
// Provision Tenant Storage
// ============================================

/**
 * Creates a tenant-specific S3 bucket with appropriate permissions.
 */
export async function provisionTenantStorage(
  input: ProvisionStorageInput
): Promise<ProvisionStorageResult> {
  const tracer = createActivityTracer('provisionTenantStorage', input.tenantId);
  tracer.start();
  tracer.addAttributes({ tenantKey: input.tenantKey });

  const ctx = Context.current();
  ctx.heartbeat('Creating tenant storage bucket');

  const bucketName = `arc-saas-tenant-${input.tenantKey}`;
  const region = process.env.AWS_REGION || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';

  logger.info('Provisioning tenant storage', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    bucketName,
  });

  try {
    const client = getS3Client();

    // Check if bucket already exists
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucketName }));
      logger.info('Bucket already exists', { bucketName });
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        // Bucket doesn't exist, create it
        ctx.heartbeat('Creating S3 bucket');

        await client.send(
          new CreateBucketCommand({
            Bucket: bucketName,
            // Only include LocationConstraint for non-us-east-1 regions
            ...(region !== 'us-east-1' && {
              CreateBucketConfiguration: {
                LocationConstraint: region as any,
              },
            }),
          })
        );

        logger.info('Bucket created', { bucketName });

        // Set bucket CORS policy for web access
        ctx.heartbeat('Configuring bucket CORS');

        await client.send(
          new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
              CORSRules: [
                {
                  AllowedHeaders: ['*'],
                  AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                  AllowedOrigins: ['*'], // In production, restrict to tenant domains
                  ExposeHeaders: ['ETag', 'x-amz-meta-*'],
                  MaxAgeSeconds: 3600,
                },
              ],
            },
          })
        );

        logger.info('Bucket CORS configured', { bucketName });
      } else {
        throw error;
      }
    }

    // Create folder structure for tenant
    ctx.heartbeat('Creating folder structure');

    // Note: S3 doesn't have real folders, but we can create empty objects
    // that act as folder markers. This is optional as folders are created
    // automatically when objects are uploaded.

    tracer.success({ bucketName, region });
    logger.info('Tenant storage provisioned successfully', {
      tenantId: input.tenantId,
      bucketName,
      endpoint,
      region,
    });

    return {
      bucketName,
      endpoint,
      region,
      success: true,
    };
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to provision tenant storage', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      error: message,
    });
    throw new ServiceUnavailableError(`Failed to provision tenant storage: ${message}`);
  }
}

// ============================================
// Deprovision Tenant Storage
// ============================================

/**
 * Deletes a tenant's S3 bucket and all its contents.
 */
export async function deprovisionTenantStorage(
  input: DeprovisionStorageInput
): Promise<void> {
  const tracer = createActivityTracer('deprovisionTenantStorage', input.tenantId);
  tracer.start();
  tracer.addAttributes({ tenantKey: input.tenantKey, forceDelete: input.forceDelete });

  const ctx = Context.current();
  const bucketName = `arc-saas-tenant-${input.tenantKey}`;

  logger.info('Deprovisioning tenant storage', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    bucketName,
    forceDelete: input.forceDelete,
  });

  try {
    const client = getS3Client();

    // Check if bucket exists
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        logger.info('Bucket does not exist, nothing to delete', { bucketName });
        tracer.success();
        return;
      }
      throw error;
    }

    // Delete all objects in the bucket first (required before bucket deletion)
    if (input.forceDelete) {
      ctx.heartbeat('Deleting all objects in bucket');
      await emptyBucket(client, bucketName, ctx);
    }

    // Delete the bucket
    ctx.heartbeat('Deleting bucket');

    await client.send(new DeleteBucketCommand({ Bucket: bucketName }));

    tracer.success();
    logger.info('Tenant storage deprovisioned successfully', {
      tenantId: input.tenantId,
      bucketName,
    });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to deprovision tenant storage', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      error: message,
    });
    throw new ServiceUnavailableError(`Failed to deprovision tenant storage: ${message}`);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Empties all objects from a bucket.
 */
async function emptyBucket(
  client: S3Client,
  bucketName: string,
  ctx: Context
): Promise<void> {
  let continuationToken: string | undefined;
  let deletedCount = 0;

  do {
    // List objects in batch
    const listResponse = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    const objects = listResponse.Contents || [];

    if (objects.length === 0) {
      break;
    }

    // Delete objects in batch
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key! })),
          Quiet: true,
        },
      })
    );

    deletedCount += objects.length;
    ctx.heartbeat(`Deleted ${deletedCount} objects from bucket`);

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  logger.info('Bucket emptied', { bucketName, deletedCount });
}

// ============================================
// Get Tenant Storage Info
// ============================================

interface StorageInfo {
  bucketName: string;
  exists: boolean;
  objectCount?: number;
  totalSizeBytes?: number;
}

/**
 * Gets information about a tenant's storage bucket.
 */
export async function getTenantStorageInfo(
  tenantKey: string
): Promise<StorageInfo> {
  const bucketName = `arc-saas-tenant-${tenantKey}`;
  const client = getS3Client();

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));

    // Get object count and size
    let objectCount = 0;
    let totalSizeBytes = 0;
    let continuationToken: string | undefined;

    do {
      const listResponse = await client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        })
      );

      const objects = listResponse.Contents || [];
      objectCount += objects.length;
      totalSizeBytes += objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return {
      bucketName,
      exists: true,
      objectCount,
      totalSizeBytes,
    };
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return {
        bucketName,
        exists: false,
      };
    }
    throw error;
  }
}

// ============================================
// Cleanup
// ============================================

export function closeS3Client(): void {
  if (s3Client) {
    s3Client.destroy();
    s3Client = null;
  }
}
