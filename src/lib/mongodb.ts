import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || '';

// `undefined` makes the driver use the database named in the URI path
// (...mongodb.net/sih26152?...), keeping the URI authoritative.
const DB_NAME = process.env.MONGODB_DB || undefined;

const options = {
  maxPoolSize: 10,
  // Bound how long a single request will wait for a reachable node. Without
  // this the driver's 30s default is paid by every request during an outage.
  serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 5000),
  connectTimeoutMS: 5000,
};

/** How long to stop retrying after a connection failure. */
const CIRCUIT_OPEN_MS = Number(process.env.MONGODB_CIRCUIT_MS || 30000);

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoCircuitOpenUntil: number | undefined;
}

/**
 * Returns a pooled Db handle, or null when Mongo is unconfigured or unhealthy.
 *
 * Two things this guards against:
 *
 * 1. Connection leaks. The client promise is cached on `globalThis` in EVERY
 *    environment. Vercel reuses the Node process across invocations of a warm
 *    serverless function, so constructing a new MongoClient per call leaks a
 *    connection per request and exhausts the Atlas connection limit under load
 *    (timeline playback alone fires 5 analytics calls per second).
 *
 * 2. Slow failure. When Atlas is unreachable -- a paused cluster, an IP
 *    allowlist that does not include the current host, or a venue network --
 *    retrying on every request makes each one wait for the full selection
 *    timeout, and the dashboard grinds to a halt instead of falling back to the
 *    in-memory store. After a failure the circuit stays open for
 *    CIRCUIT_OPEN_MS and callers get an immediate null.
 */
export async function getDatabase(): Promise<Db | null> {
  if (!uri) return null;

  const now = Date.now();
  if (global._mongoCircuitOpenUntil && now < global._mongoCircuitOpenUntil) {
    return null; // fail fast; the caller falls back to the memory store
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((error) => {
      // Clear the cached rejection so a later request can retry once the
      // circuit closes, rather than being poisoned permanently.
      global._mongoClientPromise = undefined;
      throw error;
    });
  }

  try {
    const connectedClient = await global._mongoClientPromise;
    global._mongoCircuitOpenUntil = undefined;
    return connectedClient.db(DB_NAME);
  } catch (error) {
    global._mongoCircuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    console.warn(
      `MongoDB unreachable; serving from in-memory store for the next ${
        CIRCUIT_OPEN_MS / 1000
      }s. Check the Atlas IP allowlist and that the cluster is not paused.`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/** True when a database is reachable. Used by auth, which must fail closed. */
export async function isDatabaseAvailable(): Promise<boolean> {
  const db = await getDatabase();
  if (!db) return false;
  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    global._mongoCircuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    return false;
  }
}
