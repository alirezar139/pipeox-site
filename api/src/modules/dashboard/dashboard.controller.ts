import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AdminGuard } from '../auth/guards.js';

/** Admin home: counters and the latest inquiries. */
@UseGuards(AdminGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Get()
  async summary() {
    const db = this.conn;
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const [newInquiries, weekInquiries, totalInquiries, customers, subscribers, products, articles, latest] = await Promise.all([
      db.collection('inquiries').countDocuments({ status: 'new' }),
      db.collection('inquiries').countDocuments({ createdAt: { $gte: weekAgo } }),
      db.collection('inquiries').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('subscribers').countDocuments(),
      db.collection('products').countDocuments({ published: true }),
      db.collection('articles').countDocuments({ published: true }),
      db.collection('inquiries').find({}, { projection: { name: 1, category: 1, status: 1, createdAt: 1 } }).sort({ _id: -1 }).limit(6).toArray(),
    ]);
    return { newInquiries, weekInquiries, totalInquiries, customers, subscribers, products, articles, latest };
  }
}
