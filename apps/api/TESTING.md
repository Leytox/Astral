# Unit testing (Jest)

Jest + ts-jest is configured for the API. Reference implementations to imitate:

- `src/auth/auth.service.spec.ts` — service with Prisma/Config/Token/Cookie/Email deps
- `src/auth/auth.controller.spec.ts` — thin controller delegation tests
- `src/auth/token.service.spec.ts` — simple service
- `src/auth/guards/auth.guards.spec.ts` — guard behavior

## Running

```sh
cd apps/api
npx jest                     # all unit tests
npx jest src/songs           # subset
```

Jest is configured with `watchman: false`, `testRegex: .*\.spec\.ts$`, roots under
`src/`. Never use `--coverage` when iterating locally (it is slow); run it once at
the end if asked.

## Config notes (do NOT edit)

- `tsconfig.spec.json` — the tsconfig used by ts-jest (CommonJS emit, `rootDir: src`).
- `moduleNameMapper` stubs two modules so unit tests never load heavy/ESM code:
  - `.*generated/prisma/client$` → `src/test/mocks/generated-prisma-client.ts`
    (the real generated client is ESM and cannot be `require()`d; every import of it
    in `src/` is type-only)
  - `^@repo/types$` → `packages/types/src/index.ts` (the built dist is ESM)

## Mocking recipes

Always build the module with `Test.createTestingModule` from `@nestjs/testing`.
All mocks are plain objects of `jest.fn()`. Type problems in specs: `as any` is
fine and expected (strictNullChecks is on).

### PrismaService

```ts
const mockDb = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  // add models used by the service: album, song, genre, playlist, playlistSong,
  // likedAlbum, likedSong, userSession, passwordReset, ...
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};
// ...
{ provide: PrismaService, useValue: mockDb },
```

### ConfigService / cache / S3 / queues

```ts
{ provide: ConfigService, useValue: { get: jest.fn() } },
{ provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } }, // token from '@nestjs/cache-manager'
{ provide: 'default_S3ModuleConnectionToken', useValue: { getObject: jest.fn(), headObject: jest.fn(), putObject: jest.fn(), deleteObject: jest.fn(), listBuckets: jest.fn() } }, // @InjectS3() token
{ provide: getQueueToken('audio'), useValue: { add: jest.fn() } }, // getQueueToken from '@nestjs/bullmq'
```

### External packages that must be mocked (ESM or slow)

```ts
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() })); // only in specs that load auth.service
jest.mock('geoip-lite', () => ({ lookup: jest.fn() })); // only in specs that load auth.service
jest.mock('ua-parser-js', () => ({ UAParser: jest.fn() })); // decorator spec (ESM)
jest.mock('child_process', () => ({ spawn: jest.fn() })); // audio.service (ffmpeg)
```

`fs/promises` (`writeFile`, `copyFile`, `unlink`) and `os.tmpdir()` writes are
sandbox-restricted in CI/dev shells — mock them instead of touching real temp
files.

### Passport / terminus

- Guards: the three trivial guards (`JwtAccessGuard`, `JwtRefreshGuard`,
  `LocalAuthGuard`) are covered in `src/auth/guards/auth.guards.spec.ts` — do not
  duplicate. `OptionalJwtAuthGuard.handleRequest` is also covered there.
- `HealthIndicatorService` mock:
  `{ check: jest.fn(() => ({ up: jest.fn((d) => ({ status: 'up', ...d })), down: jest.fn((d) => ({ status: 'down', ...d })) })) }`

## Rules

- Create ONLY `*.spec.ts` files next to the code under test. Never modify `src/`
  production files, `package.json`, or any tsconfig.
- Cover every public method: happy path + each error branch (the services throw
  `NotFoundException`, `ConflictException`, `BadRequestException`,
  `UnauthorizedException`, `UnprocessableEntityException` from `@nestjs/common`).
- Controllers are thin wrappers: one test per endpoint asserting it delegates the
  exact args to the service and returns its result.
- Assert call args with `toHaveBeenCalledWith(expect.objectContaining(...))` and
  `expect.any(Date)` where timestamps/uuids are involved.
- `jest.clearAllMocks()` in `beforeEach` when reusing shared mocks.
- Run `npx jest <your spec paths>` until everything is green before finishing.
