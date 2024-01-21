import {
  StackContext,
  Cron,
  Table,
  Bucket,
  Function,
  Queue
} from 'sst/constructs';
import loadConfigs from './config/loadConfigs';
import {
  Architecture,
  Code,
  LayerVersion,
  Runtime,
  StartingPosition
} from 'aws-cdk-lib/aws-lambda';

require('events').EventEmitter.defaultMaxListeners = 125;

export function Core({ stack }: StackContext) {
  const configs = loadConfigs(stack.stage);

  stack.setDefaultFunctionProps({
    environment: {
      RSS_URL: configs.rssUrl,
      TEST_AUDIO_URL: configs.testAudioUrl,
      TEST_AUDIO_DURATION: configs.testAudioDuration,
      CHUNK_SIZE_IN_SECONDS: configs.chunkSizeInSeconds,
      OPEN_AI_API_URL: configs.openAiApiUrl,
      NODE_OPTIONS: '--enable-source-maps'
    }
  });

  const ffmpegLayer = new LayerVersion(stack, 'ffmpegLayer', {
    code: Code.fromAsset('stacks/ffmpeg.zip'),
    compatibleRuntimes: [Runtime.NODEJS_18_X],
    compatibleArchitectures: [Architecture.ARM_64]
  });

  // Podcast Subscriber
  const podcastSubscriber = new Cron(stack, 'cron', {
    schedule: configs.cronJobRate,
    job: 'packages/functions/src/podcastSubscriber/index.handler',
  });

  // Podcast Source Audio
  const audioChunksCreatedQueue = new Queue(stack, 'audioChunksCreatedQueue');
  const audioChunksDLQ = new Queue(stack, 'audioChunksDLQ');

  const podcastSourceAudioProcessor = new Function(
    stack,
    'sourceAudioProcessor',
    {
      handler: 'packages/functions/src/s3Events/audioFiles/source.handler',
      permissions: ['s3', 'dynamodb'],
      runtime: 'nodejs18.x',
      architecture: 'arm_64',
      layers: [ffmpegLayer]
    }
  );

  const podcastAudioBucket = new Bucket(stack, 'Podcasts-audio', {
    notifications: {
      sourceAudioProcessor: {
        type: 'function',
        function: podcastSourceAudioProcessor,
        events: ['object_created'],
        filters: [{ prefix: 'source' }, { suffix: '.mp3' }]
      },
      audioChunksCreated: {
        type: 'queue',
        queue: audioChunksCreatedQueue,
        events: ['object_created'],
        filters: [{ prefix: 'chunks' }, { suffix: '.mp3' }]
      }
    }
  });

  // Podcast Chunk Audio
  const podcastChunksAudioProcessor = new Function(
    stack,
    'chunksAudioProcessor',
    {
      handler: 'packages/functions/src/s3Events/audioFiles/chunks.handler',
      permissions: ['s3', 'dynamodb'],
      runtime: 'nodejs18.x',
      architecture: 'arm_64',
      deadLetterQueue: audioChunksDLQ.cdk.queue
    }
  );

  audioChunksCreatedQueue.addConsumer(stack, {
    function: podcastChunksAudioProcessor,
    cdk: {
      eventSource: {
        batchSize: 1
      }
    }
  });

  // Podcast Table and Stream
  const podcastDBStreamHandler = new Function(
    stack,
    'podcastDBStreamHandler',
     {
      handler: 'packages/functions/src/ddbStreams/podcast/index.handler',
      permissions: ['s3'],
      runtime: 'nodejs18.x',
      architecture: 'arm_64',
     },
  )

  const podcastTable = new Table(stack, 'Podcasts', {
    fields: {
      id: 'string',
      title: 'string',
      summary: 'string',
      url: 'string',
      audioUrl: 'string',
      audioSize: 'number',
      audioDuration: 'number',
      audioS3Location: 'string',
      isoCreatedAt: 'string'
    },
    primaryIndex: { partitionKey: 'id' },
    stream: 'new_image',
    consumers: {
      podcastDBStreamHandler: {
        function: podcastDBStreamHandler,
        cdk: {
          eventSource: {
            startingPosition: StartingPosition.TRIM_HORIZON
          }
        },
      },
    }
  });

  // Podcast Audio Process Table and Stream
  const podcastAudioProcessSucceedDBStreamHandler = new Function(
    stack,
    'podcastAudioProcessSucceedDBStreamHandler', {
      handler: 'packages/functions/src/ddbStreams/podcastAudioProcessSucceed/index.handler',
      permissions: ['s3'],
      runtime: 'nodejs18.x',
      architecture: 'arm_64',
    }
  )

  const podcastAudioProcessTable = new Table(stack, 'PodcastAudioProcess', {
    fields: {
      id: 'string',
      isoCreatedAt: 'string',
      isoUpdatedAt: 'string',
      numberSucceedChunks: 'number'
    },
    primaryIndex: { partitionKey: 'id' },
    stream: 'new_and_old_images',
    consumers: {
      podcastAudioProcessSucceedDBStreamHandler: {
        function: podcastAudioProcessSucceedDBStreamHandler,
        cdk: {
          eventSource: {
            startingPosition: StartingPosition.TRIM_HORIZON
          }
        },
        filters: [
          {
            dynamodb: {
              NewImage: {
                processStatus: {
                  S: ["Succeed"]
                }
              }
            },
          },
        ],
      }
    }
  });

  // Permissions
  podcastSubscriber.attachPermissions(['dynamodb']);

  // Resource binding
  podcastSubscriber.bind([podcastTable]);
  podcastSourceAudioProcessor.bind([podcastTable, podcastAudioProcessTable]);
  podcastChunksAudioProcessor.bind([podcastAudioProcessTable]);
  podcastDBStreamHandler.bind([podcastAudioBucket]);
  podcastAudioProcessSucceedDBStreamHandler.bind([podcastAudioBucket]);
}
