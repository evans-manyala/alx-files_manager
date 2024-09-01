import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.dbName = database;

    // Connection to MongoDB
    this.client.connect()
      .then(() => {
        this.db = this.client.db(this.dbName);
        console.log('Connected to MongoDB');
      })
      .catch((err) => {
        console.error('Failed to connect to MongoDB', err);
      });
  }

  // Check for MongoDB connection if alive
  isAlive() {
    return this.client.isConnected();
  }

  // Get the no of documents in the "users" collection
  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  // Get the no of documents in the "files" collection
  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

// Create and export an instance of DBClient
const dbClient = new DBClient();
module.exports = dbClient;
