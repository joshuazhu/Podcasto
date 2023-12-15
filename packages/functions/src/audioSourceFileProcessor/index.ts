import { S3Event } from 'aws-lambda';

import ffmpeg from 'fluent-ffmpeg';
import { S3 } from 'aws-sdk';

import * as fs from 'fs';
import { getPodcastByIdFromDB } from '../libs/dynamodbFunctions';
import { Config } from 'sst/node/config';
const util = require('util');
const exec = util.promisify(require('child_process').exec);

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

// try{

//   const audioFileButter = await fs.readFile("packages/audio/processed/output_1.mp3")
//   const form = new FormData()

//   form.append('model', 'whisper-1');
//   form.append('file', audioFileButter, {
//     filename: "output_1.mp3",
//     contentType: "audio/mp3"
//   })

//   const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
//     headers: {
//       ...form.getHeaders(),
//       Authorization: "Bearer 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"
//     }
//   })

//   console.log(response)
// } catch(e) {
//   console.log('Error', e)
// }

// console.timeEnd('start processing file')

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
    console.log(`Audio chunks created successfully: ${chunkFileName}`);

    durationOffset += chunkSizeInSeconds;
  }

  console.timeEnd('Chunk audio file file');
}
