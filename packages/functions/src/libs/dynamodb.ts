import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  NativeScalarAttributeValue,
} from "@aws-sdk/util-dynamodb";

class DynamoDB {
  private client: DynamoDBDocumentClient;

  constructor() {
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: 'us-east-1' })
    );
  }

  async getAll(tableName: string): Promise<Record<string, any>[]> {
    const params = {
      TableName: tableName
    };

    const command = new ScanCommand(params);
    const response = await this.client.send(command);

    if (!response.Items) return [];
    return response.Items;
  }

  async putItem(
    tableName: string,
    data: { [key: string]: NativeScalarAttributeValue | string[] }
  ): Promise<void> {
    const params = {
      TableName: tableName,
      Item: { ...data },
    };

    await this.client.send(new PutCommand(params));
  }
}

export const DB = new DynamoDB();
