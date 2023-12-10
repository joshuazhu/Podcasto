import z from "zod"

export type CustomFeed = {};
export type CustomItem = {
  itunes: {
    duration: string;
  };
};

export const PodcastSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  videoUrl: z.string(),
  videoSize: z.number(),
  videoDuration: z.number(),
  videoS3Location: z.string().optional(),
  isoCreatedAt: z.string()
})

export type PodcastType = z.infer<typeof PodcastSchema>


