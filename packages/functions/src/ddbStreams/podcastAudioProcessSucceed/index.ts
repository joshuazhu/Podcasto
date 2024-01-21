import { DynamoDBStreamEvent } from "aws-lambda";
import { S3 } from "aws-sdk";

const s3 = new S3({
  region: 'ap-southeast-2'
})

export async function handler(event: DynamoDBStreamEvent) {
  console.log(JSON.stringify(event, null, 2))

  const record = event.Records[0]
  const podcastId = record.dynamodb?.Keys!["id"]

  const chunkAudioTextPrefix = `/chunks/${podcastId}`
  // const reponse = await s3.listObjectsV2({
  //   Bucket
  // })

}
