import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const options = {};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getDatabase(): Promise<Db | null> {
  if (!uri) {
    // Graceful fallback to memory/mock store if MongoDB Atlas URI is not yet provided
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }

  try {
    const connectedClient = await clientPromise;
    return connectedClient.db('sih_social_intelligence');
  } catch (error) {
    console.warn('MongoDB Atlas connection failed. Falling back to local data engine.', error);
    return null;
  }
}
