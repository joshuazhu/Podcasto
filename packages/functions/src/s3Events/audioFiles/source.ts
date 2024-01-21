import { S3Event } from 'aws-lambda';

import ffmpeg from 'fluent-ffmpeg';
import { S3 } from 'aws-sdk';

import * as fs from 'fs';
import { getPodcastByIdFromDB } from '../../libs/db/dynamodbFunctions';
import { Config } from 'sst/node/config';
import { DB } from '../../libs/db/dynamodb';
import { Table } from 'sst/node/table';
import { AudioProcessStatus } from '../../types';
const util = require('util');

// import axios from 'axios'
// import FormData from 'form-data'
// import fs from 'fs/promises'

ffmpeg.setFfmpegPath(`/opt/ffmpeg`);

const s3 = new S3();

function chunkAudio({
  inputFile,
  outputDirectory,
  startTime,
  chunkFileName,
  chunkSizeInSeconds
}: {
  inputFile: string;
  outputDirectory: string;
  startTime: number;
  chunkFileName: string;
  chunkSizeInSeconds: number;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(inputFile)
      .audioCodec('copy') // Use 'copy' to avoid re-encoding audio
      .setStartTime(startTime)
      .setDuration(chunkSizeInSeconds)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(`${outputDirectory}/${chunkFileName}`);
  });
}

export async function handler(event: S3Event) {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  const record = event.Records[0];

  const bucket = record.s3.bucket.name;
  const key = record.s3.object.key;

  // get podcast from DB
  const podcastId = key.split('/').reverse()[0].replace('.mp3', '');
  const podcast = await getPodcastByIdFromDB(podcastId);

  if (!podcast) {
    console.error(`Cannot find podcast where id is ${podcastId}`);
  }

  // get audio file
  const response = await s3
    .getObject({
      Bucket: bucket,
      Key: key
    })
    .promise();

  const fileContent = response.Body as Buffer;
  const localSourceAudioPath = `/tmp/${key.split('/').reverse()[0]}`;
  fs.writeFileSync(localSourceAudioPath, fileContent);

  const outputDirectory = '/tmp/processed/';

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
  }

  let durationOffset = 0;
  let totalNumberOfChunks = 0;

  console.time('Chunk audio file file');
  const chunkSizeInSeconds = Number.parseInt(
    process.env.CHUNK_SIZE_IN_SECONDS || '0'
  ); // Adjust as needed
  const audioDuration =
    Config.STAGE !== 'prod'
      ? Number.parseInt(process.env.TEST_AUDIO_DURATION || '0')
      : podcast?.audioDuration || 0;

  while (durationOffset < audioDuration) {
    let chunkFileName = `${podcastId}_part_${
      durationOffset / chunkSizeInSeconds
    }.mp3`;
    await chunkAudio({
      inputFile: localSourceAudioPath,
      outputDirectory,
      startTime: durationOffset,
      chunkFileName,
      chunkSizeInSeconds
    });

    durationOffset += chunkSizeInSeconds;
    totalNumberOfChunks += 1;
  }

  console.timeEnd('Chunk audio file file');

  await DB.putItem(Table.PodcastAudioProcess.tableName, {
    id: podcastId,
    isoCreatedAt: (new Date()).toISOString(),
    numberOfProcessedChunks: 0,
    totalNumberOfChunks,
    processStatus: AudioProcessStatus.Enum['In Progress']
  })

  const uploadChunkRequests = fs.readdirSync(outputDirectory).map(fileName => s3.upload({
      Bucket: bucket,
      Key: `chunks/${fileName}`,
      Body: fs.readFileSync(`${outputDirectory}/${fileName}`)
    }).promise()
  )

  console.log(`Uploading ${uploadChunkRequests.length} chunks to s3`)

  await Promise.all(uploadChunkRequests)
}
