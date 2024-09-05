import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { ObjectId } = mongoose.Types;

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const user = mongoose.model('user', userSchema);

const UsersController = {
  async postNew(req, res) {
    try {
      const { email, password } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }

      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      // Check for existing user
      const existingUser = await user.findOne({ email });

      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash password using bcrypt
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const newUser = new user({ email, password: hashedPassword });

      await newUser.save();
      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      await redisClient.set(`auth_${token}`, newUser._id, 3600);
      return res.status(201).json({ id: newUser._id, email: newUser.email, token });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'An error occurred while creating the user.' });
    }
  },

  async getMe(req, res) {
    const token = req.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userObjectId = new ObjectId(userId);
      const user = await dbClient.db.collection('users').findOne({ _id: userObjectId });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      console.error('Invalid userId:', error);
      return res.status(400).json({ error: 'Invalid userId' });
    }
  },
};

export default UsersController;
