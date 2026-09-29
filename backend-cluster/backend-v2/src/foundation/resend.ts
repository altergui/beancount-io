import { Resend as ResendClient } from "resend";
import { logger } from "@/shared/logger";

export type ResendOpts = {
  apiKey: string;
  retryLimit: number;
  defaultFrom?: string;
};

type Mail = {
  from?: string;
  to: string | Array<string>;
  subject: string;
  html?: string;
  text?: string;
};

export interface IResend {
  sendMail(data: Mail): Promise<void>;
}

export class Resend implements IResend {
  public opts: ResendOpts;
  private client: ResendClient;

  constructor(opts: ResendOpts) {
    this.opts = opts;
    this.client = new ResendClient(opts.apiKey);
  }

  public async sendMail(data: Mail): Promise<void> {
    const from = data.from || this.opts.defaultFrom || "noreply@mail.beancount.io";
    // Resend's CreateEmailOptions requires html or text as a genuine string,
    // not string | undefined, so the branch has to be picked at compile time.
    const payload = data.html
      ? { from, to: data.to, subject: data.subject, html: data.html, text: data.text }
      : { from, to: data.to, subject: data.subject, text: data.text ?? "" };

    for (let i = this.opts.retryLimit; i > 0; i -= 1) {
      try {
        const { error } = await this.client.emails.send(payload);
        if (error) {
          throw new Error(`${error.name}: ${error.message}`);
        }
        return;
      } catch (e) {
        logger.error(`failed to Resend.sendMail: ${e}`);
        if (i === 1) {
          throw e;
        }
      }
    }
  }
}

export class ConsoleResend implements IResend {
  public opts: ResendOpts;

  constructor(opts: ResendOpts) {
    this.opts = opts;
    logger.debug("ConsoleResend initialized for development environment");
  }

  public async sendMail(data: Mail): Promise<void> {
    logger.debug("ConsoleResend.sendMail called with data:", {
      to: data.to,
      from: data.from || this.opts.defaultFrom || "noreply@mail.beancount.io",
      subject: data.subject,
      html: data.html,
      text: data.text,
    });
  }
}
