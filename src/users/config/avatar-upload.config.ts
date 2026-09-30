import { memoryStorage } from 'multer';

export const avatarUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
};
