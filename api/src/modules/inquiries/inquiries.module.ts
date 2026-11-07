import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InquiriesController } from './inquiries.controller.js';
import { Inquiry, InquirySchema } from './inquiry.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Inquiry.name, schema: InquirySchema }])],
  controllers: [InquiriesController],
})
export class InquiriesModule {}
