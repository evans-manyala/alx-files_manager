import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    try {
      const usrID = await FilesController.getUserIDFromToken(req);
      if (!usrID) return res.status(401).json({ error: 'Unauthorized' });

      const validationError = FilesController.validateFileData(req.body);
      if (validationError) return res.status(400).json({ error: validationError });

      const {
        name, type, parentId = 0, isPublic = false, data,
      } = req.body;

      if (parentId !== 0) {
        const parentError = await FilesController.checkParentFile(parentId);
        if (parentError) return res.status(400).json({ error: parentError });
      }

      const newFile = await FilesController.createFileDocument({
        usrID, name, type, isPublic, parentId, data,
      });
      return res.status(201).json(newFile);
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }

  static async getShow(req, res) {
    try {
      const { id } = req.params;
      const usrID = await FilesController.getUserIDFromToken(req);
      if (!usrID) return res.status(401).json({ error: 'Unauthorized' });

      const file = await dbClient.db.collection('files').findOne({ _id: id, usrID });
      if (!file) return res.status(404).json({ error: 'Not found' });

      return res.status(200).json(file);
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }

  static async getIndex(req, res) {
    try {
      const usrID = await FilesController.getUserIDFromToken(req);
      if (!usrID) return res.status(401).json({ error: 'Unauthorized' });

      const { parentId = 0, page = 0 } = req.query;
      const pageSize = 20;
      const skip = page * pageSize;

      const files = await dbClient.db.collection('files').aggregate([
        { $match: { usrID, parentId: parseInt(parentId, 10) } },
        { $skip: skip },
        { $limit: pageSize },
      ]).toArray();

      return res.status(200).json(files);
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }

  static async putPublish(req, res) {
    try {
      const { id } = req.params;
      const usrID = await FilesController.getUserIDFromToken(req);
      if (!usrID) return res.status(401).json({ error: 'Unauthorized' });

      const result = await dbClient.db.collection('files').updateOne(
        { _id: id, usrID },
        { $set: { isPublic: true } },
      );

      if (result.matchedCount === 0) return res.status(404).json({ error: 'Not found' });

      return res.status(200).json({ message: 'File published' });
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }

  static async putUnpublish(req, res) {
    try {
      const { id } = req.params;
      const usrID = await FilesController.getUserIDFromToken(req);
      if (!usrID) return res.status(401).json({ error: 'Unauthorized' });

      const result = await dbClient.db.collection('files').updateOne(
        { _id: id, usrID },
        { $set: { isPublic: false } },
      );

      if (result.matchedCount === 0) return res.status(404).json({ error: 'Not found' });

      return res.status(200).json({ message: 'File unpublished' });
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }

  static async getFile(req, res) {
    try {
      const { id } = req.params;
      const usrID = await FilesController.getUserIDFromToken(req);
      if (!usrID) return res.status(401).json({ error: 'Unauthorized' });

      const file = await dbClient.db.collection('files').findOne({ _id: id });
      if (!file) return res.status(404).json({ error: 'Not found' });

      if (!file.isPublic && file.usrID !== usrID) return res.status(404).json({ error: 'Not found' });
      if (file.type === 'folder') return res.status(400).json({ error: 'A folder doesn\'t have content' });
      if (!file.localPath || !fs.existsSync(file.localPath)) return res.status(404).json({ error: 'Not found' });

      const mimeType = mime.lookup(file.localPath) || 'application/octet-stream';
      const fileData = await fs.promises.readFile(file.localPath);

      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(fileData);
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred while retrieving the file data.' });
    }
  }

  static async getUserIDFromToken(req) {
    const token = req.header('X-Token');
    const usrID = await redisClient.get(`auth_${token}`);
    return usrID;
  }

  static validateFileData({ name, type, data }) {
    if (!name) return 'Missing name';
    if (!['folder', 'file', 'image'].includes(type)) return 'Invalid type';
    if (type !== 'folder' && !data) return 'Missing data';
    return null;
  }

  static async checkParentFile(parentId) {
    const parentFile = await dbClient.db.collection('files').findOne({ _id: parentId });
    if (!parentFile) return 'Parent not found';
    if (parentFile.type !== 'folder') return 'Parent is not a folder';
    return null;
  }

  static async createFileDocument({
    usrID, name, type, isPublic, parentId, data,
  }) {
    const fileData = {
      usrID, name, type, isPublic, parentId,
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileData);
      return FilesController.buildFileResponse(result.insertedId, fileData);
    }

    const filePath = await FilesController.saveFileToDisk(data);
    fileData.localPath = filePath;

    const result = await dbClient.db.collection('files').insertOne(fileData);
    return FilesController.buildFileResponse(result.insertedId, fileData);
  }

  static async saveFileToDisk(data) {
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const fileName = uuidv4();
    const filePath = path.join(folderPath, fileName);
    const buffer = Buffer.from(data, 'base64');

    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  static buildFileResponse(id, fileData) {
    return {
      id,
      usrID: fileData.usrID,
      name: fileData.name,
      type: fileData.type,
      isPublic: fileData.isPublic,
      parentId: fileData.parentId,
      localPath: fileData.localPath,
    };
  }
}

export default FilesController;
