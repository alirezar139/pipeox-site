import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { trusted, type Model } from 'mongoose';
import { objectId, slug } from '../../common/utils/text.js';
import { AdminGuard } from '../auth/guards.js';
import { Product, productInput, type ProductInput } from './product.schema.js';

const PUBLIC_FIELDS = '-__v -published -createdAt';

@Controller()
export class ProductsController {
  constructor(@InjectModel(Product.name) private readonly products: Model<Product>) {}

  /* ───────── Public ───────── */

  @Get('products')
  list() {
    return this.products.find({ published: true }).sort({ sort: 1, _id: 1 }).select(PUBLIC_FIELDS).lean();
  }

  @Get('products/:slug')
  async one(@Param('slug', { schema: slug }) s: string) {
    const p = await this.products.findOne({ slug: s, published: true }).select(PUBLIC_FIELDS).lean();
    if (!p) throw new NotFoundException('محصول پیدا نشد.');
    return p;
  }

  /* ───────── Admin ───────── */

  @UseGuards(AdminGuard)
  @Get('admin/products')
  adminList() {
    return this.products.find().sort({ sort: 1, _id: 1 }).lean();
  }

  @UseGuards(AdminGuard)
  @Get('admin/products/:id')
  async adminOne(@Param('id', { schema: objectId }) id: string) {
    const p = await this.products.findById(id).lean();
    if (!p) throw new NotFoundException();
    return p;
  }

  @UseGuards(AdminGuard)
  @Post('admin/products')
  create(@Body({ schema: productInput }) body: ProductInput) {
    return this.save(null, body);
  }

  @UseGuards(AdminGuard)
  @Put('admin/products/:id')
  update(@Param('id', { schema: objectId }) id: string, @Body({ schema: productInput }) body: ProductInput) {
    return this.save(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/products/:id')
  async remove(@Param('id', { schema: objectId }) id: string) {
    if (!(await this.products.findByIdAndDelete(id))) throw new NotFoundException();
    return { ok: true };
  }

  private async save(id: string | null, body: ProductInput) {
    if (await this.products.exists({ slug: body.slug, ...(id ? { _id: trusted({ $ne: id }) } : {}) })) {
      throw new ConflictException({ message: 'این نامک برای محصول دیگری استفاده شده است.', field: 'slug' });
    }
    if (body.orbit) {
      // each homepage slot holds one product
      await this.products.updateMany({ orbit: body.orbit, ...(id ? { _id: trusted({ $ne: id }) } : {}) }, { orbit: '' });
    }
    if (!id) return this.products.create(body);
    const doc = await this.products.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true });
    if (!doc) throw new NotFoundException();
    return doc;
  }
}
