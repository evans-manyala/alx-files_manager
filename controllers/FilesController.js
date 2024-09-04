import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    try {
      const {
        name, type, parentId = 0, isPublic = false, data,
      } = req.body;
      const token = req.header('X-Token');
      const userId = await redisClient.get(`auth_${token}`);

      // Validating user authentication
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validating input fields
      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }
      if (!['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (!data && type !== 'folder') {
        return res.status(400).json({ error: 'Missing data' });
      }

      // Confirm if parentId is valid
      if (parentId !== 0) {
        const parentFile = await dbClient.db.collection('files').findOne({ _id: parentId });
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      // Creating file document for folders
      const fileData = {
        userId,
        name,
        type,
        isPublic,
        parentId,
      };

      if (type === 'folder') {
        const result = await dbClient.db.collection('files').insertOne(fileData);
        return res.status(201).json({
          id: result.insertedId,
          userId,
          name,
          type,
          isPublic,
          parentId,
        });
      }

      // Handling file or image types
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const fileName = uuidv4();
      const filePath = path.join(folderPath, fileName);
      const buffer = Buffer.from(data, 'base64');

      // Saving file to disk
      await fs.promises.writeFile(filePath, buffer);

      // Save file metadata to database
      fileData.localPath = filePath;
      const result = await dbClient.db.collection('files').insertOne(fileData);

      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
        localPath: filePath,
      });
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }
}

module.exports = FilesController;
