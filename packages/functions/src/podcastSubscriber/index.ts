import Parser from 'rss-parser';
import { CustomFeed, CustomItem, PodcastType } from '../types';
import { getLatestPodcastsFromDB } from './getPodcastsFromDB';
import { DB } from '../libs/dynamodb';
import { Config } from 'sst/node/config';
import { Table } from "sst/node/table";

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
  videoUrl: (item.enclosure?.url || '').split('https').reverse()[0],
  videoSize: item.enclosure?.length || 0,
  videoDuration: durationToSeconds(item.itunes.duration || '0'),
  videoS3Location: '',
  isoCreatedAt: item.isoDate || new Date().toISOString()
});

export async function handler() {
  try{
    const parser: Parser<CustomFeed, CustomItem> = new Parser({
      customFields: {
        feed: [],
        item: ['itunes']
      }
    });

    const feed = await parser.parseURL(process.env.RSS_URL || "");
    const latestPodcast = await getLatestPodcastsFromDB()
    const podcasts = feed.items.map(mapPodcast);

    const newPodcasts = !!latestPodcast ? podcasts.filter(p => p.isoCreatedAt > latestPodcast.isoCreatedAt) : podcasts;

    let requests: Promise<void>[]

    if(Config.STAGE !== "prod") {
      const newTestPodcast = newPodcasts[0]
      requests = [DB.putItem(Table.Podcasts.tableName, {
        ...newTestPodcast,
        videoUrl: process.env.testAudiUrl
      })]
    } else {
      requests = newPodcasts.map(p => DB.putItem(Table.Podcasts.tableName, p))
    }

    await Promise.all(requests)
  }catch(e) {
    console.log('error', e)
  }
}
