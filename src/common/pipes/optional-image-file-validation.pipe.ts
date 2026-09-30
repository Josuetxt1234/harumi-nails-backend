import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class OptionalImageFileValidationPipe implements PipeTransform {
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  private readonly maxSizeInBytes = 5 * 1024 * 1024;

  transform(file?: Express.Multer.File): Express.Multer.File | undefined {
    if (!file) {
      return undefined;
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Avatar must be an image file (jpeg, png, webp, or gif).',
      );
    }

    if (file.size > this.maxSizeInBytes) {
      throw new BadRequestException('Avatar file size must not exceed 5MB.');
    }

    return file;
  }
}
