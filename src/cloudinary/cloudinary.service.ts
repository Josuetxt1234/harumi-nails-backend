import {
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiErrorResponse, UploadApiResponse, v2 as Cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import * as streamifier from 'streamifier';
import {
  CLOUDINARY,
  CLOUDINARY_ERROR_MESSAGES,
} from './constants/cloudinary.constants';
import { CloudinaryUploadResult } from './interfaces/cloudinary-upload-result.interface';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY)
    private readonly cloudinary: typeof Cloudinary,
    private readonly configService: ConfigService,
  ) {}

  async uploadImage(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<CloudinaryUploadResult> {
    this.assertConfigured();

    if (!file?.buffer?.length) {
      throw new InternalServerErrorException(CLOUDINARY_ERROR_MESSAGES.INVALID_FILE);
    }

    const targetFolder =
      folder ??
      this.configService.get<string>('cloudinary.avatarsFolder') ??
      'harumi-nails/avatars';

    try {
      const uploadResult = await this.uploadBuffer(file.buffer, targetFolder);

      return {
        publicId: uploadResult.public_id,
        secureUrl: this.buildOptimizedAvatarUrl(uploadResult.public_id),
        url: uploadResult.url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        CLOUDINARY_ERROR_MESSAGES.UPLOAD_FAILED,
        {
          cause: error,
        },
      );
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    this.assertConfigured();

    if (!publicId) {
      return;
    }

    try {
      await this.cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new InternalServerErrorException(
        CLOUDINARY_ERROR_MESSAGES.DELETE_FAILED,
        {
          cause: error,
        },
      );
    }
  }

  extractPublicIdFromUrl(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }

    try {
      const withoutQuery = url.split('?')[0];
      const avatarsFolder =
        this.configService.get<string>('cloudinary.avatarsFolder') ??
        'harumi-nails/avatars';
      const folderIndex = withoutQuery.indexOf(avatarsFolder);

      if (folderIndex !== -1) {
        return withoutQuery.slice(folderIndex).replace(/\.[^/.]+$/, '');
      }

      const uploadSegment = '/upload/';
      const uploadIndex = withoutQuery.indexOf(uploadSegment);

      if (uploadIndex === -1) {
        return null;
      }

      const pathAfterUpload = withoutQuery.slice(
        uploadIndex + uploadSegment.length,
      );
      const segments = pathAfterUpload.split('/');
      const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
      const publicSegments =
        versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments.slice(-1);

      return publicSegments.join('/').replace(/\.[^/.]+$/, '');
    } catch {
      return null;
    }
  }

  buildOptimizedAvatarUrl(publicId: string): string {
    return this.cloudinary.url(publicId, {
      secure: true,
      transformation: [
        {
          crop: 'auto',
          gravity: 'auto',
          width: 500,
          height: 500,
        },
        {
          fetch_format: 'auto',
          quality: 'auto',
        },
      ],
    });
  }

  private assertConfigured(): void {
    const cloudName = this.configService.get<string>('cloudinary.cloudName');
    const apiKey = this.configService.get<string>('cloudinary.apiKey');
    const apiSecret = this.configService.get<string>('cloudinary.apiSecret');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        CLOUDINARY_ERROR_MESSAGES.NOT_CONFIGURED,
      );
    }
  }

  private uploadBuffer(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [
            {
              crop: 'auto',
              gravity: 'auto',
              width: 500,
              height: 500,
            },
            {
              fetch_format: 'auto',
              quality: 'auto',
            },
          ],
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error || !result) {
            reject(error ?? new Error(CLOUDINARY_ERROR_MESSAGES.UPLOAD_FAILED));
            return;
          }

          resolve(result);
        },
      );

      const readableStream: Readable = streamifier.createReadStream(buffer);
      readableStream.pipe(uploadStream);
    });
  }
}
