import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('Missing required environment variable: "MONGODB_URI"');
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  return new MongoClient(uri).connect();
}

const clientPromise = uri ? getClientPromise() : null;

export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    throw new Error('Missing required environment variable: "MONGODB_URI"');
  }

  const client = await clientPromise;
  const dbName = process.env.MONGODB_DB_NAME ?? "pandit-g";
  return client.db(dbName);
}
