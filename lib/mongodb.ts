import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGO_URL) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGO_URL;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise_v2?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise_v2) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise_v2 = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise_v2;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}

export default clientPromise;