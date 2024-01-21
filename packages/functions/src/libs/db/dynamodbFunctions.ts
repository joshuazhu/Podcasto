import { z } from 'zod';
import { DB, dynamoDbItem } from './dynamodb';
import {
  PodcastSchema,
  PodcastType,
  PodcastAudioProcessType,
  PodcastAudioProcessSchema
} from '../../types';
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

export const getLatestPodcastsFromDB = async (): Promise<
  PodcastType | undefined
> => {
  const podcastsInDB = await getPodcastsFromDB();

  return podcastsInDB.sort((a, b) => {
    if (a.isoCreatedAt < b.isoCreatedAt) return 1;
    else if (a.isoCreatedAt > b.isoCreatedAt) return -1;
    return 0;
  })[0];
};

export const getPodcastByIdFromDB = async (
  id: string
): Promise<PodcastType | undefined> => {
  const podcastDbItem = await DB.getByKey(Table.Podcasts.tableName, 'id', id);

  const podcast = PodcastSchema.safeParse(podcastDbItem);

  if (podcast.success) {
    return podcast.data;
  }

  console.error(`Failed to parse DB records to Podcast: ${podcast.error}`);
  return;
};

export const getPodcastAudioProcessByIdFromDB = async(id: string): Promise<PodcastAudioProcessType | undefined> => {
  const podcastAudioProcessDbItem = await DB.getByKey(Table.PodcastAudioProcess.tableName, 'id', id);
  const audioProcess = PodcastAudioProcessSchema.safeParse(podcastAudioProcessDbItem)

  if(audioProcess.success) {
    return audioProcess.data;
  }

  console.error(`Failed to parse DB records to PodcastAudioProcess: ${audioProcess.error}`);
  return
}

export const updatePodcastAudioProcessTable = async (
  id: string,
  updateRecord: dynamoDbItem[],
  conditions: dynamoDbItem[],
): Promise<void> => {
  await DB.updateItem(
    Table.PodcastAudioProcess.tableName,
    { id: id },
    updateRecord,
    conditions
  );
};


