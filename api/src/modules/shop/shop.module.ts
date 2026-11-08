import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/product.schema.js';
import { SettingsModule } from '../settings/settings.module.js';
import { User, UserSchema } from '../users/user.schema.js';
import { Order, OrderSchema } from './order.schema.js';
import { OrdersController } from './orders.controller.js';
import { ShopService } from './shop.service.js';

/** Online shop: cart pricing, orders, Shaparak payments (Mellat, Saman, Sadad) and bank transfers. */
@Module({
  imports: [
    SettingsModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [ShopService],
})
export class ShopModule {}
