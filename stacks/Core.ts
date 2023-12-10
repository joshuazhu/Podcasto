import { StackContext, Cron, Table, KinesisStream, Bucket } from "sst/constructs";
import loadConfigs from "./config/loadConfigs";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";

export function Core({ stack }: StackContext) {
  const configs = loadConfigs(stack.stage)

  stack.setDefaultFunctionProps({
    environment: {
      RSS_URL: configs.rssUrl,
      TEST_AUDIO_URL: configs.testAudioUrl,
      CHUNK_SIZE_IN_SECONDS: configs.chunkSizeInSeconds,
      OPEN_AI_API_URL: configs.openAiApiUrl
    }
  })

  const podcastAudioBucket = new Bucket(stack, "Podcasts-audio")

  stack.addDefaultFunctionEnv({
    AUDIO_BUCKET: podcastAudioBucket.bucketName
  })

  const podcastTable = new Table(stack, "Podcasts", {
    fields: {
      id: "string",
      title: "string",
      summary: "string",
      url: "string",
      audioUrl: "string",
      audioSize: "number",
      audioDuration: "number",
      audioS3Location: "string",
      isoCreatedAt: "string"
    },
    primaryIndex: { partitionKey: "id"},
    stream: 'new_image',
    consumers: {
      podcastDBStreamHandler: {
        function: "packages/functions/src/podcastDBStreamHandler/index.handler",
        cdk: {
          eventSource: {
            startingPosition: StartingPosition.TRIM_HORIZON
          }
        },
      }
    }
  })

  podcastTable.attachPermissionsToConsumer("podcastDBStreamHandler", ["s3"])

  const podcastSubscriber = new Cron(stack, "cron", {
    schedule: configs.cronJobRate,
    job: "packages/functions/src/podcastSubscriber/index.handler",
  })

  podcastSubscriber.attachPermissions(["dynamodb"])
  podcastSubscriber.bind([podcastTable])
}
