import { StackContext, Cron, Table } from "sst/constructs";
import loadConfigs from "./config/loadConfigs";

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

  const podcastTable = new Table(stack, "Podcasts", {
    fields: {
      id: "string",
      title: "string",
      summary: "string",
      url: "string",
      videoUrl: "string",
      videoSize: "number",
      videoDuration: "number",
      videoS3Location: "string",
      isoCreatedAt: "string"
    },
    primaryIndex: { partitionKey: "id"},
  })

  const podcastSubscriber = new Cron(stack, "cron", {
    schedule: configs.cronJobRate,
    job: "packages/functions/src/podcastSubscriber/index.handler",
  })

  podcastSubscriber.attachPermissions(["dynamodb"])
  podcastSubscriber.bind([podcastTable])
}
