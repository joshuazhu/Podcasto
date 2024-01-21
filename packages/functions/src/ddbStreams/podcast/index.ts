import { DynamoDBStreamEvent } from 'aws-lambda'
import { DynamoDB, S3 } from 'aws-sdk'
import { PodcastSchema } from '../../types';
import axios from 'axios';
import { Bucket } from 'sst/node/bucket';

const s3 = new S3();

export async function handler (event: DynamoDBStreamEvent) {
  for(const record of event.Records) {
    if (record.eventName === 'INSERT') {
      // Handle INSERT event
      const podcastDbItem = DynamoDB.Converter.unmarshall(record.dynamodb?.NewImage!)

      const podcast = PodcastSchema.safeParse(podcastDbItem)

      if(!podcast.success) {
        console.log('Failed to parse podcast', podcast.error)
        return
      }

      const fileKey = `${podcast.data.id}.mp3`
      const audioUrl = podcast.data.audioUrl

      console.log('audio URL', audioUrl)

      const reponse = await axios.get(audioUrl, { responseType: 'arraybuffer' })
      const buffer = Buffer.from(reponse.data)

      console.log('uploading s3', Bucket['Podcasts-audio'].bucketName)

      await s3.upload({
        Bucket: Bucket['Podcasts-audio'].bucketName,
        Key: `source/${fileKey}`,
        Body: buffer
      }).promise()

      console.log('upload s3 completed')

    }
  }
}

export default handler
