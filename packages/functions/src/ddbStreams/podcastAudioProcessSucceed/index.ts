import { DynamoDBStreamEvent } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { Bucket } from 'sst/node/bucket';

const s3 = new S3({
  region: 'ap-southeast-2'
});

export async function handler(event: DynamoDBStreamEvent) {
  const record = event.Records[0];
  const podcastId = record.dynamodb?.Keys!['id'].S;

  const chunkAudioTextPrefix = `audioText/${podcastId}/${podcastId}_part_`;
  console.log(`Getting all the chunks for ${chunkAudioTextPrefix}`);

  const allAudioTextFileResponse = await s3
    .listObjectsV2({
      Bucket: Bucket['Podcasts-audio'].bucketName,
      Prefix: chunkAudioTextPrefix
    })
    .promise();

  if (allAudioTextFileResponse.Contents?.length === 0) {
    console.log('No chunk audi text file found');
    return;
  }

  const chunkAudioTextFiles = allAudioTextFileResponse.Contents?.sort();

  let totalAudioText: string = '';

  for (let i = 0; i < (chunkAudioTextFiles?.length || 0); i++) {
    const params = {
      Bucket: Bucket['Podcasts-audio'].bucketName,
      Key: chunkAudioTextFiles![i].Key!
    };

    const audioTextResponse = await s3.getObject(params).promise();
    const content = audioTextResponse?.Body?.toString() || '';

    totalAudioText += '\n';
    totalAudioText += content;
  }

  console.log(totalAudioText);
}
