const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');

class UsersController {
  static hashPassword(password) {
    return crypto.createHash('sha1').update(password).digest('hex');
  }

  static sendHTTPError(res, statusCode, message) {
    return res.status(statusCode).json({ error: message });
  }

  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return UsersController.sendHTTPError(res, 400, 'Missing email');
    }

    if (!password) {
      return UsersController.sendHTTPError(res, 400, 'Missing password');
    }

    try {
      const dbUser = await dbClient.db.collection('users').findOne({ email });
      if (dbUser) {
        return UsersController.sendHTTPError(res, 400, 'Error: User exists');
      }

      const hashedPassword = UsersController.hashPassword(password);
      const newUser = await dbClient.db.collection('users').insertOne({ email, password: hashedPassword });

      return res.status(201).json({ id: newUser.insertedId, email });
    } catch (error) {
      console.error('Error while creating user:', error);
      return UsersController.sendHTTPError(res, 500, 'Error while creating new user');
    }
  }

  static async getUserData(req) {
    const token = req.headers['x-token'];
    const userId = await dbClient.db.collection('auth_tokens').findOne({ token });

    if (!userId) {
      throw new Error('Unauthorized');
    }

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  static async getMe(req, res) {
    try {
      const user = await UsersController.getUserData(req);
      return res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      console.error('Error retrieving user:', error);
      return UsersController.sendHTTPError(res, 401, 'Unauthorized');
    }
  }
}

module.exports = UsersController;
