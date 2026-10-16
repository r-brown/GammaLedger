/* AWS Lambda adapter (API Gateway HTTP API, payload v2) with DynamoDB.
   Table: partition key "pk" (string). One item per leaderboard ("board#<id>")
   holding the top 100, plus one item "levels". Set TABLE_NAME in the environment.
   Uses the AWS SDK v3 that ships with the Node.js 18+ Lambda runtimes. */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { handleApi } from './api.mjs';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

const getList = async pk => ((await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk } }))).Item || {}).list || [];
const putList = (pk, list) => ddb.send(new PutCommand({ TableName: TABLE, Item: { pk, list } }));
const store = {
  getBoard: id => getList('board#' + id),
  putBoard: (id, list) => putList('board#' + id, list),
  getLevels: () => getList('levels'),
  putLevels: list => putList('levels', list)
};

export const handler = async event => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/';
  const query = new URLSearchParams(event.rawQueryString || '');
  let rawBody = event.body;
  if (rawBody && event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
  const res = await handleApi({ method, path, query, rawBody }, store);
  return { statusCode: res.status, headers: res.headers, body: res.body };
};
