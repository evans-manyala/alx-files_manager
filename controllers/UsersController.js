import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const existingUser = await dbClient.collection('users').findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash the password using SHA1
      const hashedPassword = sha1.createHash('sha1').update(password).digest('hex');

      // Create and save the new user
      const result = await dbClient.collection('users').insertOne({
        email,
        password: hashedPassword,
      });

      // Respond with the new user
      const newUser = result.ops[0]; // The inserted document
      res.status(201).json({
        id: newUser._id,
        email: newUser.email,
      });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while creating the user.' });
    }
  }
}

export default UsersController;
