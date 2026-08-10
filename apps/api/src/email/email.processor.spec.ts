import { Test } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailProcessor } from './email.processor';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  const mockMailerService = { sendMail: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    processor = moduleRef.get(EmailProcessor);
  });

  it('delegates the job data to MailerService.sendMail', async () => {
    const jobData = {
      to: 'john@example.com',
      template: './welcome',
      context: { firstName: 'John' },
    };

    await processor.process({ data: jobData } as any);

    expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
    expect(mockMailerService.sendMail).toHaveBeenCalledWith(jobData);
  });
});
