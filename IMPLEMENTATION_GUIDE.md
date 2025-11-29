# Практические рекомендации по реализации улучшений

## Обзор приоритетных улучшений

Основываясь на анализе архитектуры проекта "generate-kp", ниже представлены практические рекомендации по поэтапной реализации улучшений.

---

## Немедленные улучшения (1-2 дня)

### 1. Удаление неиспользуемых зависимостей

**Статус**: ✅ Выполнено (multer удален)

**Рекомендации**:
- Регулярно проверяйте package.json на наличие "мертвых" зависимостей
- Используйте `npm ls` для выявления неиспользуемых пакетов
- Добавьте в CI скрипт проверку зависимостей

### 2. Замена console.log на структурированное логирование

**Проблема**: 30 console statements в коде
**Решение**: Добавить Winston logger

```bash
npm install winston winston-daily-rotate-file
```

```javascript
// utils/logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

module.exports = logger;
```

**Применение**:
```javascript
// Замена console.log("Сообщение") на:
logger.info('Сообщение', { module: 'server', action: 'start' });
```

---

## Краткосрочные улучшения (1 неделя)

### 3. Введение TypeScript

**Шаг 1**: Установка TypeScript
```bash
npm install --save-dev typescript @types/node @types/express
npx tsc --init
```

**Шаг 2**: Настройка tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Шаг 3**: Создание базовых типов
```typescript
// src/types/index.ts
export interface Lot {
  description: string;
  count: string;
  price?: number;
  total?: number;
}

export interface CompanyData {
  name: string;
  unp: string;
  address: string;
}

export interface ProposalData extends CompanyData {
  date: string;
  place: string;
  payment: string;
  endDate: string;
  lots: Lot[];
  freeDescription?: string;
}

export interface GenerateRequest {
  url: string;
  unitPrice: number;
  unitPrice2?: number;
  includeLot1: boolean;
  includeLot2: boolean;
  freeDescription?: string;
}
```

### 4. Рефакторинг обработки ошибок

**Создание пользовательских ошибок**:
```typescript
// src/errors/AppError.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400);
    this.name = 'ValidationError';
    this.field = field;
  }
  field?: string;
}

export class ParsingError extends AppError {
  constructor(message: string, url?: string) {
    super(message, 422);
    this.name = 'ParsingError';
    this.url = url;
  }
  url?: string;
}
```

**Центральный обработчик ошибок**:
```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        status: err.statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Логирование неожиданных ошибок
  logger.error('Unexpected error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      status: 500,
      timestamp: new Date().toISOString()
    }
  });
}
```

---

## Среднесрочные улучшения (2-4 недели)

### 5. Модульная архитектура

**Создание структуры папок**:
```
src/
├── controllers/
│   ├── generateController.ts
│   └── healthController.ts
├── services/
│   ├── ParserService.ts
│   ├── PDFGeneratorService.ts
│   └── ValidationService.ts
├── middleware/
│   ├── errorHandler.ts
│   ├── validation.ts
│   └── logging.ts
├── utils/
│   ├── browserManager.ts
│   ├── cache.ts
│   └── logger.ts
├── types/
│   ├── index.ts
│   └── errors.ts
└── config/
    ├── index.ts
    └── constants.ts
```

**Рефакторинг контроллеров**:
```typescript
// src/controllers/generateController.ts
import { Request, Response } from 'express';
import { ValidationService } from '../services/ValidationService';
import { ParserService } from '../services/ParserService';
import { PDFGeneratorService } from '../services/PDFGeneratorService';
import { AppError } from '../types/errors';

export class GenerateController {
  constructor(
    private validationService: ValidationService,
    private parserService: ParserService,
    private pdfGeneratorService: PDFGeneratorService
  ) {}

  async generate(req: Request, res: Response, next: Function) {
    try {
      const {
        url,
        unitPrice,
        unitPrice2,
        includeLot1,
        includeLot2,
        freeDescription
      } = req.body;

      // Валидация
      this.validationService.validateGenerateRequest(req.body);

      // Парсинг данных
      const parsedData = await this.parserService.parsePage(url);

      // Генерация PDF
      const result = await this.pdfGeneratorService.generatePDFFromURL(
        parsedData,
        {
          unitPrice,
          unitPrice2,
          includeLot1,
          includeLot2,
          freeDescription
        }
      );

      res.json({
        success: true,
        fileName: result.fileName,
        filePath: result.filePath
      });
    } catch (error) {
      next(error);
    }
  }
}
```

### 6. Улучшение кеширования

```typescript
// utils/cache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class SmartCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 1000;
  private defaultTTL = 5 * 60 * 1000; // 5 минут

  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate()
    };
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private calculateHitRate(): number {
    // Простой расчет hit rate для мониторинга
    return this.cache.size / this.maxSize;
  }
}
```

---

## Долгосрочные улучшения (1-2 месяца)

### 7. Docker контейнеризация

**Dockerfile**:
```dockerfile
# Multi-stage build
FROM node:18-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

# Установка системных зависимостей для Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Непривилегированный пользователь
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/images ./images

USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
    volumes:
      - ./logs:/app/logs
      - ./generated:/app/generated
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 8. Мониторинг и метрики

```typescript
// utils/metrics.ts
export class Metrics {
  private static instance: Metrics;
  private counters = new Map<string, number>();
  private timers = new Map<string, number[]>();

  static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  incrementCounter(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + value);
    logger.debug(`Counter incremented: ${name}`, { value, total: this.counters.get(name) });
  }

  recordTime(name: string, duration: number): void {
    const times = this.timers.get(name) || [];
    times.push(duration);
    this.timers.set(name, times);

    // Автоматический отчет каждые 100 записей
    if (times.length >= 100) {
      this.reportTimings(name, times);
      this.timers.set(name, []);
    }
  }

  getMetrics() {
    const counters = Object.fromEntries(this.counters);
    const timers = Object.fromEntries(
      Array.from(this.timers.entries()).map(([name, times]) => [
        name,
        {
          count: times.length,
          avg: times.reduce((a, b) => a + b) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: this.calculatePercentile(times, 95)
        }
      ])
    );

    return { counters, timers };
  }

  private reportTimings(name: string, times: number[]): void {
    const avg = times.reduce((a, b) => a + b) / times.length;
    const p95 = this.calculatePercentile(times, 95);
    
    logger.info(`Metrics report`, {
      metric: name,
      count: times.length,
      avg: avg.toFixed(2),
      p95: p95.toFixed(2)
    });
  }

  private calculatePercentile(times: number[], percentile: number): number {
    const sorted = times.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
}

// Middleware для автоматического измерения
export function measureTime(name: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      Metrics.getInstance().recordTime(name, duration);
    });
    
    next();
  };
}
```

---

## CI/CD pipeline

### GitHub Actions workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run tests
      run: npm test
    
    - name: Build application
      run: npm run build

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security audit
      run: npm audit --audit-level moderate
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  deploy:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker image
      run: docker build -t generate-kp:latest .
    
    - name: Deploy to production
      run: |
        # Команды деплоя
        echo "Deploying to production..."
```

---

## Тестирование

### Настройка Jest

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
```

### Примеры тестов

```typescript
// tests/services/PDFGeneratorService.test.ts
import { PDFGeneratorService } from '../../src/services/PDFGeneratorService';

describe('PDFGeneratorService', () => {
  let service: PDFGeneratorService;

  beforeEach(() => {
    service = new PDFGeneratorService();
  });

  describe('generatePDFFromURL', () => {
    it('should generate PDF successfully', async () => {
      const mockData = {
        companyName: 'Test Company',
        unp: '123456789',
        // ... other mock data
      };

      const result = await service.generatePDFFromURL(
        'https://goszakupki.by/test',
        100,
        200,
        true,
        false,
        'Test description'
      );

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_test\.pdf$/);
    });

    it('should handle validation errors', async () => {
      await expect(
        service.generatePDFFromURL('invalid-url', 0, 0, false, false, '')
      ).rejects.toThrow('ValidationError');
    });
  });
});
```

---

## Заключение

Реализация этих улучшений поэтапно позволит:

1. **Повысить качество кода** через типизацию и лучшие практики
2. **Улучшить надежность** через тестирование и обработку ошибок  
3. **Упростить развертывание** через Docker и CI/CD
4. **Обеспечить масштабируемость** через модульную архитектуру
5. **Улучшить наблюдаемость** через метрики и логирование

Рекомендуется начать с краткосрочных улучшений (логирование, TypeScript), затем переходить к среднесрочным (архитектура, тестирование), и в завершение реализовать долгосрочные цели (Docker, мониторинг).