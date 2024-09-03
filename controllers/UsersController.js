import crypto from 'crypto';
import dbClient from '../utils/db';

const UsersController = {
  async postNew(req, res) {
    const { email, password } = req.body;

    // Check for missing fields
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    // Validate for existing email (implementation within UsersController)
    const existingUser = await dbClient.db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Already exists' });
    }

    // Hash password
    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

    // Create new user object
    const newUser = {
      email,
      password: hashedPassword,
    };

    // Save user to "users" collection (implementation within UsersController)
    await dbClient.db.collection('users').insertOne(newUser);

    res.status(201).json({
      id: newUser._id,
      email: newUser.email,
    });
  },
};

module.exports = UsersController;
