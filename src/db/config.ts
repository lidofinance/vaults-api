import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import 'dotenv/config';

export const ormConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  // entities: [
  //   'dist/db/vault-db/entities/vault.entity.js',
  //   'dist/db/vault-db/entities/vault-member.entity.js',
  //   'dist/db/vault-db/entities/vault-state.entity.js',
  //   'dist/db/report-db/entities/report.entity.js',
  //   'dist/db/report-db/entities/report-leaf.entity.js',
  //   'dist/db/vault-db/entities/vault-report-stat.entity.js',
  // ],
  entities: ['dist/**/*.entity{.ts,.js}'],
  migrations: ['dist/db/migrations/*.js'],
  migrationsTableName: 'migrations',
  ssl: false,
  // This hack is required to get SQL query durations:
  // unfortunately, TypeORM doesn't expose an official API to get the exact duration,
  // so we have to treat all queries as "slow" by setting the minimum threshold maxQueryExecutionTime = 1ms.
  maxQueryExecutionTime: 1, // It doesn’t work with 0
  logging: ['query', 'error'],
};

// needs to export this as argument -d for typeorm migration:run
export const dataSource = new DataSource(ormConfig);

export const getTypeOrmConfig = (): TypeOrmModuleOptions => ormConfig;
