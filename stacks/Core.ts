import { StackContext, Cron, Table, Bucket, Function } from 'sst/constructs';
import loadConfigs from './config/loadConfigs';
import { Architecture, Code, LayerVersion, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';

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
    code: Code.fromAsset('stacks/Archive.zip'),
    compatibleRuntimes: [Runtime.NODEJS_18_X],
    compatibleArchitectures: [Architecture.ARM_64]
  })

  const podcastSourceAudioProcessor = new Function(
    stack,
    'sourceAudioProcessor',
    {
      handler: 'packages/functions/src/audioSourceFileProcessor/index.handler',
      permissions: ['s3'],
      runtime: 'nodejs18.x',
      architecture: 'arm_64',
      layers: [
        ffmpegLayer
      ],
    }
  );


  const podcastAudioBucket = new Bucket(stack, 'Podcasts-audio', {
    notifications: {
      sourceAudioProcessor: {
        function: podcastSourceAudioProcessor,
        events: ["object_created"],
        filters: [{prefix: "source"}, {suffix: ".mp3"}]
      }
    }
  });

  stack.addDefaultFunctionEnv({
    AUDIO_BUCKET: podcastAudioBucket.bucketName
  });

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
        function: 'packages/functions/src/podcastDBStreamHandler/index.handler',
        cdk: {
          eventSource: {
            startingPosition: StartingPosition.TRIM_HORIZON
          }
        }
      }
    }
  });

  podcastTable.attachPermissionsToConsumer('podcastDBStreamHandler', ['s3']);

  const podcastSubscriber = new Cron(stack, 'cron', {
    schedule: configs.cronJobRate,
    job: 'packages/functions/src/podcastSubscriber/index.handler'
  });

  podcastSubscriber.attachPermissions(['dynamodb']);
  podcastSubscriber.bind([podcastTable]);

  podcastSourceAudioProcessor.attachPermissions(['dynamodb']);
  podcastSourceAudioProcessor.bind([podcastTable]);
}
