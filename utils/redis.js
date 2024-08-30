import { createClient } from 'redis';

class RedisClient {
    constructor() {
        this.client = createClient();

        // Handle connectivity errors
        this.client.on('error', (err) => console.error('Redis Client Error', err));
    }

    // Confirm if Redis connectivity is alive
    isAlive() {
        return this.client.connected;
    }

    // Getting the value of a key from Redis
    async get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, value) => {
                if (err) {
                    return reject(err);
                }
                resolve(value);
            });
        });
    }

    // Setting a key-value pair in Redis with expiration time
    async set(key, value, duration) {
        return new Promise((resolve, reject) => {
            this.client.set(key, value, 'EX', duration, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve(true);
            });
        });
    }

    // Deleting a key-value pair from Redis
    async del(key) {
        return new Promise((resolve, reject) => {
            this.client.del(key, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve(true);
            });
        });
    }
}

// Creating & exporting an instance of RedisClient
const redisClient = new RedisClient();
module.exports = redisClient;
