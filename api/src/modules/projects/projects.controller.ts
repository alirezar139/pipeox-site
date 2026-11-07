import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { objectId } from '../../common/utils/text.js';
import { AdminGuard } from '../auth/guards.js';
import { Project, projectInput, type ProjectInput } from './project.schema.js';

@Controller()
export class ProjectsController {
  constructor(@InjectModel(Project.name) private readonly projects: Model<Project>) {}

  @Get('projects')
  list() {
    return this.projects.find({ published: true }).sort({ sort: 1, _id: 1 }).select('-__v -published').lean();
  }

  @UseGuards(AdminGuard)
  @Get('admin/projects')
  adminList() {
    return this.projects.find().sort({ sort: 1, _id: 1 }).lean();
  }

  @UseGuards(AdminGuard)
  @Post('admin/projects')
  create(@Body({ schema: projectInput }) body: ProjectInput) {
    return this.projects.create(body);
  }

  @UseGuards(AdminGuard)
  @Put('admin/projects/:id')
  async update(@Param('id', { schema: objectId }) id: string, @Body({ schema: projectInput }) body: ProjectInput) {
    const doc = await this.projects.findByIdAndUpdate(id, body, { returnDocument: 'after' });
    if (!doc) throw new NotFoundException();
    return doc;
  }

  @UseGuards(AdminGuard)
  @Delete('admin/projects/:id')
  async remove(@Param('id', { schema: objectId }) id: string) {
    if (!(await this.projects.findByIdAndDelete(id))) throw new NotFoundException();
    return { ok: true };
  }
}
