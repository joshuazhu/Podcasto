import z from "zod"

export type CustomFeed = {};
export type CustomItem = {
  itunes: {
    duration: string;
  };
};

export const AudioProcessStatus = z.enum(["In Progress", "Succeed", "Failed"])

export const PodcastSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  audioUrl: z.string(),
  audioSize: z.number(),
  audioDuration: z.number(),
  audioS3Location: z.string().optional(),
  isoCreatedAt: z.string()
})

export const PodcastAudioProcessSchema = z.object({
  id: z.string(),
  isoCreatedAt: z.string(),
  isoUpdatedAt: z.string().optional(),
  numberOfProcessedChunks: z.number(),
  totalNumberOfChunks: z.number(),
  processStatus: AudioProcessStatus
})

export type PodcastType = z.infer<typeof PodcastSchema>
export type PodcastAudioProcessType = z.infer<typeof PodcastAudioProcessSchema>
