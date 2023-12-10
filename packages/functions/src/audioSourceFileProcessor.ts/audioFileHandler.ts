// import ffmpeg from 'fluent-ffmpeg';
// import axios from 'axios'
// import FormData from 'form-data'
// import fs from 'fs/promises'

// ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg')

// function chunkAudio(inputFile: string, outputDirectory: string, startTime: number, chunkFileName: string, chunkSizeInSeconds: number): Promise<void> {
//   return new Promise<void>((resolve, reject) => {
//       ffmpeg()
//           .input(inputFile)
//           .audioCodec('copy') // Use 'copy' to avoid re-encoding audio
//           .setStartTime(startTime)
//           .setDuration(chunkSizeInSeconds)
//           .on('end', () => resolve())
//           .on('error', (err) => reject(err))
//           .save(`${outputDirectory}/${chunkFileName}`);
//   });
// }

// Example usage:
  // const inputFile = 'packages/audio/ALLIN-E004.mp3';
  // const outputDirectory = 'packages/audio/processed';
  // const chunkSizeInSeconds = 600; // Adjust as needed
  // const duration = 4729;

// let startTime = 0

  // while(startTime < duration) {
  //   let chunkFileName = `output_${startTime / chunkSizeInSeconds + 1}.mp3`
  //   console.log('')
  //   await chunkAudio(inputFile, outputDirectory, startTime, chunkFileName, chunkSizeInSeconds)
  //   console.log('Audio chunks created successfully.')

  //   startTime += chunkSizeInSeconds
  // }

  // console.time('start processing file')


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
