export type ConfigType = {
  rssUrl: string
  testAudioUrl: string
  chunkSizeInSeconds: string
  openAiApiUrl: string
  cronJobRate: `rate(${string})` | `cron(${string})`
}
