import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  constructor(private readonly mailService: MailerService) {
    super();
  }
  async process(job: Job<ISendMailOptions>): Promise<void> {
    await this.mailService.sendMail(job.data);
  }
}
