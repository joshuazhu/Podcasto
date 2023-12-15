import { z } from 'zod';
import { DB } from '../libs/dynamodb';
import { PodcastSchema, PodcastType } from '../types';
import { Table } from 'sst/node/table';

export const getPodcastsFromDB = async (): Promise<PodcastType[]> => {
  const podcastsDbItems = await DB.getAll(Table.Podcasts.tableName);
  const podcasts = z.array(PodcastSchema).safeParse(podcastsDbItems);

  if (podcasts.success) {
    return podcasts.data;
  }

  console.error(`Failed to parse DB records to Podcasts: ${podcasts.error}`);
  return [];
};


export const getLatestPodcastsFromDB = async(): Promise<PodcastType | undefined> => {
  const podcastsInDB = await getPodcastsFromDB()

  return podcastsInDB.sort((a, b) => {
    if(a.isoCreatedAt < b.isoCreatedAt ) return 1
    else if(a.isoCreatedAt > b.isoCreatedAt) return -1
    return 0
  })[0]
}

export const getPodcastByIdFromDB = async(id: string): Promise<PodcastType | undefined> => {
  const podcastDbItem = await DB.getByKey(Table.Podcasts.tableName, "id", id)

  console.log(podcastDbItem)
  const podcast = PodcastSchema.safeParse(podcastDbItem)

  if(podcast.success) {
    return podcast.data;
  }

  console.log(`Failed to parse DB records to Podcast: ${podcast.error}`)
  return
}
