import {
  BadRequestException,
  Controller,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { StorageService } from "../storage/storage.service";

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Generic authenticated image upload → returns a public URL. Used wherever an
 * image is needed before its owning entity exists (e.g. a cat's photo during
 * registration, before the cat row is created). The client crops/compresses
 * first; this validates type + size and stores to object storage.
 */
@ApiTags("uploads")
@ApiBearerAuth()
@Controller("uploads")
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post("image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload an image, returns its public URL" })
  async uploadImage(@CurrentUser("id") userId: string, @UploadedFile() file: UploadedImage) {
    if (!file?.buffer?.length) throw new BadRequestException("No image provided");
    if (file.size > MAX_IMAGE_BYTES) throw new PayloadTooLargeException("Image must be 8 MB or smaller");
    const ext = this.storage.imageExt(file.mimetype);
    if (!ext) throw new BadRequestException("Only JPEG, PNG, or WebP images are allowed");

    const key = this.storage.buildKey(`users/${userId}/uploads`, ext);
    const url = await this.storage.upload(key, file.buffer, file.mimetype);
    return { url };
  }
}
