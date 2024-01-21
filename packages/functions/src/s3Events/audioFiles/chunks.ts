import { Table } from 'sst/node/table';
import { DB, dynamoDbItem } from '../../libs/db/dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  getPodcastAudioProcessByIdFromDB,
  updatePodcastAudioProcessTable
} from '../../libs/db/dynamodbFunctions';
import { AudioProcessStatus, PodcastAudioProcessType } from '../../types';
import { S3Event, SQSEvent } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import axios from 'axios';
import FormData from 'form-data';

const s3 = new S3();

// const updateAudioFileProcessWithBackoff = async (
//   remainingRetries: number,
//   audioProcess: PodcastAudioProcessType,
//   getUpdateRecord: (audioProcess: PodcastAudioProcessType) => Promise<dynamoDbItem[]>,
//   getConditions: (audioProcess: PodcastAudioProcessType) => Promise<dynamoDbItem[]>
// ): Promise<void> => {
//   const updateRecord = await getUpdateRecord(audioProcess);
//   if (remainingRetries <= 0) {
//     //TODO: log error when failed to retry
//     console.error(`UpdateItem failed after retries: ${updateRecord}`);
//     return;
//   }

//   const conditions = await getConditions(audioProcess);

//   try {
//     // Execute the updateItem command
//     await await DB.updateItem(
//       Table.PodcastAudioProcess.tableName,
//       { id: audioProcess.id },
//       updateRecord,
//       conditions
//     );
//   } catch (error) {
//     console.error('UpdateItem failed:', error);

//     if (error instanceof ConditionalCheckFailedException) {
//       // Retry with exponential backoff
//       const delay = Math.pow(2, remainingRetries) * 1000; // Exponential backoff in milliseconds
//       remainingRetries -= 1;

//       console.log(`Retrying after ${delay} milliseconds...`);
//       await sleep(delay);

//       const latestAudioProcessRecord = await getPodcastAudioProcessByIdFromDB(audioProcess.id);
//       return updateAudioFileProcessWithBackoff(
//         remainingRetries,
//         latestAudioProcessRecord!,
//         getUpdateRecord,
//         getConditions
//       );
//     } else {
//       // Non-transient error, do not retry
//       console.error(`Failed to update; ${updateRecord}`);
//       return;
//     }
//   }
// };

// Sleep function to introduce a delay
// const sleep = (ms: number) => {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// };

const mockGetTextFromAudioFile = async (
  bucket: string,
  key: string
): Promise<string> => {
  console.log(`Getting text for ${bucket}/${key}`);

  return new Promise((resolve) => resolve(`text for ${bucket}/${key}`));
};

const getTextFromAudioFile = async (
  bucket: string,
  key: string
): Promise<string> => {
  const s3Response = await s3
    .getObject({
      Bucket: bucket,
      Key: key
    })
    .promise();

  const audioFileButter = s3Response.Body as Buffer;

  const form = new FormData();

  form.append('model', 'whisper-1');
  form.append('file', audioFileButter, {
    filename: key,
    contentType: 'audio/mp3'
  });

  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization:
          'Bearer {apiKey}'
      }
    }
  );

  return response.data.text;
};

export async function handler(event: SQSEvent) {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  const queueRecord = event.Records[0];
  const s3Records = JSON.parse(queueRecord.body) as S3Event;
  const record = s3Records.Records[0];

  const bucket = record.s3.bucket.name;
  const key = record.s3.object.key;

  const chunkName = key.split('/').reverse()[0].replace('.mp3', '');
  const podcastId = chunkName.split('_')[0];

  const latestAudioProcessRecord = await getPodcastAudioProcessByIdFromDB(
    podcastId
  );

  if (latestAudioProcessRecord?.processStatus === 'Succeed') {
    console.log(
      `Skip the event due to podcast ${podcastId} had been processed`
    );
    return;
  }

  const audioText = await mockGetTextFromAudioFile(bucket, key);
  await s3
    .upload({
      Bucket: bucket,
      Key: `audioText/${podcastId}/${chunkName}.text`,
      Body: audioText
    })
    .promise();

  let updatedContent: dynamoDbItem[] = [
    {
      key: 'isoUpdatedAt',
      value: new Date().toISOString()
    },
    {
      key: 'numberOfProcessedChunks',
      value: (latestAudioProcessRecord?.numberOfProcessedChunks || 0) + 1
    }
  ];

  console.log('updated content', updatedContent);

  if (
    (latestAudioProcessRecord?.numberOfProcessedChunks || 0) + 1 ===
    latestAudioProcessRecord?.totalNumberOfChunks
  ) {
    updatedContent.push({
      key: 'processStatus',
      value: AudioProcessStatus.Enum.Succeed
    });
  }

  await updatePodcastAudioProcessTable(podcastId, updatedContent, [
    {
      key: 'numberOfProcessedChunks',
      value: latestAudioProcessRecord?.numberOfProcessedChunks
    }
  ]);
}
