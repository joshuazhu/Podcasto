import {
  DynamoDBClient
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { NativeScalarAttributeValue } from '@aws-sdk/util-dynamodb';

export type dynamoDbItem = {
  key: string;
  value: NativeScalarAttributeValue;
};

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

  async getByKey(
    tableName: string,
    keyName: string,
    keyValue: string
  ): Promise<Record<string, any> | undefined> {
    const params = {
      TableName: tableName,
      Key: {
        [keyName]: keyValue
      }
    };

    const command = new GetCommand(params);
    const response = await this.client.send(command);

    return response.Item;
  }

  async putItem(
    tableName: string,
    data: { [key: string]: NativeScalarAttributeValue | string[] }
  ): Promise<void> {
    const params = {
      TableName: tableName,
      Item: { ...data }
    };

    await this.client.send(new PutCommand(params));
  }

  async updateItem(
    tableName: string,
    keyNameValue: { [key: string]: NativeScalarAttributeValue },
    updateRecords: dynamoDbItem[],
    conditionRecords: dynamoDbItem[]
  ): Promise<void> {
    const conditionExpressions = this.getUpdateExpressions(
      conditionRecords,
      'expectedValue'
    );
    const updateExpressions = this.getUpdateExpressions(
      updateRecords,
      'newValue'
    );

    const params = {
      TableName: tableName,
      Key: keyNameValue,
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ConditionExpression: conditionExpressions.join(' AND '),
      ExpressionAttributeValues: {
        ...this.getUpdateExpressionAttributeValues(updateRecords, 'newValue'),
        ...this.getUpdateExpressionAttributeValues(conditionRecords, 'expectedValue')
      }
    };


    console.log(`update params ${JSON.stringify(params)}`);

    await this.client.send(new UpdateCommand(params));
  }

  private getUpdateExpressions = (
    records: dynamoDbItem[],
    attributeAlias: string
  ): string[] =>
    records.map(
      (record, index) => `${record.key} = :${attributeAlias}${index}`
    );

  private getUpdateExpressionAttributeValues = (
    records: dynamoDbItem[],
    attributeAlias: string
  ): {} =>
    records.reduce(
      (acc, update, index) => ({
        ...acc,
        [`:${attributeAlias}${index}`]: update.value
      }),
      {}
    );
}

export const DB = new DynamoDB();
