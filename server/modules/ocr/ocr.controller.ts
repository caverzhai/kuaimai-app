import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('api/ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('idcard')
  @UseGuards(AuthGuard)
  async recognizeIdCard(
    @Body() body: { imageUrl: string; cardType?: 'face' | 'back' },
    @Request() req: any,
  ) {
    const { imageUrl, cardType = 'face' } = body;
    
    if (!imageUrl) {
      return { success: false, error: '图片URL不能为空' };
    }

    const result = await this.ocrService.recognizeIdCard(imageUrl, cardType);
    return result;
  }
}
