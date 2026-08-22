import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, createChannel, createSession, Session } from 'better-sse';
import type { Request, Response } from 'express';
import { createClient, RedisClientType } from 'redis';
interface SseRedisMessage {
  userId?: string;
  event: string;
  data: unknown;
}
@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  private readonly globalChannel: Channel = createChannel();
  private readonly userChannels = new Map<string, Channel>();
  private readonly sseChannel = 'sse:events';
  private pubClient!: RedisClientType;
  private subClient!: RedisClientType;
  constructor(private readonly configService: ConfigService) {}
  async onModuleInit(): Promise<void> {
    const redisUrl = `redis://${this.configService.get<string>('REDIS_HOST')}:${this.configService.get<string>('REDIS_PORT')}`;
    this.pubClient = createClient({ url: redisUrl });
    this.subClient = this.pubClient.duplicate();
    this.pubClient.on('error', (err) => {
      this.logger.error('Redis Publisher Error', err);
    });
    this.subClient.on('error', (err) => {
      this.logger.error('Redis Subscriber Error', err);
    });
    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    await this.subClient.subscribe(this.sseChannel, (message) => {
      try {
        const { userId, event, data } = JSON.parse(message) as SseRedisMessage;
        if (userId) {
          const channel = this.userChannels.get(userId);
          if (channel && channel.sessionCount > 0) {
            channel.broadcast(data, event);
          }
        } else {
          this.globalChannel.broadcast(data, event);
        }
      } catch (err) {
        this.logger.error('Failed to parse SSE Redis message', err);
      }
    });
    this.logger.log('SseService connected to Redis Pub/Sub');
  }
  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.subClient?.isOpen
        ? this.subClient.unsubscribe(this.sseChannel)
        : Promise.resolve(),
      this.pubClient?.isOpen ? this.pubClient.quit() : Promise.resolve(),
      this.subClient?.isOpen ? this.subClient.quit() : Promise.resolve(),
    ]);
  }

  async registerClient(
    userId: string,
    req: Request,
    res: Response,
  ): Promise<Session> {
    const session = await createSession(req, res);
    let userChannel = this.userChannels.get(userId);
    if (!userChannel) {
      userChannel = createChannel();
      this.userChannels.set(userId, userChannel);
    }
    userChannel.register(session);
    this.globalChannel.register(session);
    session.on('disconnected', () => {
      if (userChannel && userChannel.sessionCount === 0) {
        this.userChannels.delete(userId);
      }
    });
    return session;
  }

  /**
   * Emit an event to a specific user across all API pods via Redis
   */
  async emitToUser(
    userId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    const message: SseRedisMessage = { userId, event, data };
    await this.pubClient.publish(this.sseChannel, JSON.stringify(message));
  }

  /**
   * Emit an event to all connected users across all API pods via Redis
   */
  async emitToAll(event: string, data: unknown): Promise<void> {
    const message: SseRedisMessage = { event, data };
    await this.pubClient.publish(this.sseChannel, JSON.stringify(message));
  }
}
