import {
  Repository,
  FindManyOptions,
  FindOneOptions,
  DeepPartial,
} from 'typeorm';
import { NotFoundException } from '@nestjs/common';

export abstract class BaseService<T> {
  constructor(protected readonly repository: Repository<T>) {}

  findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findOne(options: FindOneOptions<T>): Promise<T> {
    const entity = await this.repository.findOne(options);
    if (!entity) {
      throw new NotFoundException('Resource not found');
    }
    return entity;
  }

  create(dto: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(dto);
    return this.repository.save(entity);
  }

  async update(id: number, dto: DeepPartial<T>): Promise<T> {
    await this.repository.update(id, dto as any);
    return this.findOne({ where: { id } as any });
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne({ where: { id } as any });
    await this.repository.remove(entity);
  }
}
