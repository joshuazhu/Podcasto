import configs from './config.json'
import { ConfigType } from './types'

const loadConfigs = (stage: string): ConfigType => {
  const stageConfig = stage === "prod" ? configs.prod : configs.dev

  return {
    rssUrl: stageConfig.rssUrl,
    testAudioUrl: stageConfig.testAudioUrl,
    chunkSizeInSeconds: stageConfig.chunkSizeInSeconds,
    openAiApiUrl: stageConfig.openAiApiUrl,
    cronJobRate: stageConfig.cronJobRate as `rate(${string})` | `cron(${string})`
  }
}

export default loadConfigs
