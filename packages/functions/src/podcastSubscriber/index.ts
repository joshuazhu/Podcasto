import Parser from 'rss-parser';
import { CustomFeed, CustomItem, PodcastType } from '../types';
import { getLatestPodcastsFromDB } from '../libs/db/dynamodbFunctions';
import { DB } from '../libs/db/dynamodb';
import { Config } from 'sst/node/config';
import { Table } from 'sst/node/table';

const durationToSeconds = (duration: string) => {
  // assume duration is larger than one minute and smaller than one day
  const durationParts = duration.split(':');
  const hrStr = durationParts.length === 3 ? durationParts[0] : '0';
  const minStr =
    durationParts.length === 3 ? durationParts[1] : durationParts[0];
  const secStr = durationParts[durationParts.length - 1];

  return (
    Number.parseInt(hrStr) * 3600 +
    Number.parseInt(minStr) * 60 +
    Number.parseInt(secStr)
  );
};

const mapPodcast = (item: CustomItem & Parser.Item): PodcastType => ({
  id: item.guid || '',
  title: item.title || '',
  summary: item.summary || '',
  url: item.link || '',
  audioUrl: (item.enclosure?.url || '').split('https').reverse()[0],
  audioSize: Number.parseInt(item.enclosure?.length?.toString() || '0'),
  audioDuration: durationToSeconds(item.itunes.duration || '0'),
  audioS3Location: '',
  isoCreatedAt: item.isoDate || new Date().toISOString()
});

export async function handler() {
  try {
    const parser: Parser<CustomFeed, CustomItem> = new Parser({
      customFields: {
        feed: [],
        item: ['itunes']
      }
    });

    console.log('Fetching RSS feeds')
    const feed = await parser.parseURL(process.env.RSS_URL || '');
    console.log(`${feed.items.length} podcasts found`)

    const latestPodcast = await getLatestPodcastsFromDB();
    const podcasts = feed.items.map(mapPodcast);

    const newPodcasts = !!latestPodcast
      ? podcasts.filter((p) => p.isoCreatedAt >= latestPodcast.isoCreatedAt)
      : podcasts;

    console.log(`${newPodcasts.length} new podcasts found!`)

    let requests: Promise<void>[];

    if (newPodcasts.length > 0) {
      if (Config.STAGE !== 'prod') {
        requests = [
          DB.putItem(Table.Podcasts.tableName, {
            ...newPodcasts[0],
            audioUrl: process.env.TEST_AUDIO_URL
          })
        ];
      } else {
        requests = newPodcasts.map((p) =>
          DB.putItem(Table.Podcasts.tableName, p)
        );
      }
      await Promise.all(requests);
    }
  } catch (e) {
    console.log('error', e);
  }
}
