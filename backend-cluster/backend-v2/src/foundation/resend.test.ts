import { Resend, ConsoleResend } from "./resend";
import { logger } from "@/shared/logger";

const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));
jest.mock("@/shared/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Resend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendMail", () => {
    const mailData = {
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Test content</p>",
    };

    it("should successfully send email on first attempt", async () => {
      const r = new Resend({ apiKey: "test-key", retryLimit: 3 });

      mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });

      await r.sendMail(mailData);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "recipient@example.com",
          subject: "Test Subject",
          html: "<p>Test content</p>",
          from: "noreply@mail.beancount.io",
        }),
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should use custom from address when provided", async () => {
      const r = new Resend({ apiKey: "test-key", retryLimit: 3 });

      mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });

      await r.sendMail({ ...mailData, from: "custom@example.com" });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: "custom@example.com" }),
      );
    });

    it("should use defaultFrom from options when no from is provided", async () => {
      const r = new Resend({
        apiKey: "test-key",
        retryLimit: 3,
        defaultFrom: "default@example.com",
      });

      mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });

      await r.sendMail(mailData);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: "default@example.com" }),
      );
    });

    it("should retry and succeed on second attempt", async () => {
      const r = new Resend({ apiKey: "test-key", retryLimit: 3 });

      mockSend
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ data: { id: "abc" }, error: null });

      await r.sendMail(mailData);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it("should throw and log when the API returns an error payload", async () => {
      const r = new Resend({ apiKey: "test-key", retryLimit: 1 });

      mockSend.mockResolvedValue({
        data: null,
        error: { name: "validation_error", message: "invalid `to` field" },
      });

      await expect(r.sendMail(mailData)).rejects.toThrow(
        "validation_error: invalid `to` field",
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it("should retry up to retryLimit and throw error after all retries fail", async () => {
      const r = new Resend({ apiKey: "test-key", retryLimit: 2 });

      const error = new Error("Persistent error");
      mockSend.mockRejectedValue(error);

      await expect(r.sendMail(mailData)).rejects.toThrow("Persistent error");

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledTimes(2);
    });

    it("should handle multiple recipients", async () => {
      const r = new Resend({ apiKey: "test-key", retryLimit: 3 });

      mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });

      await r.sendMail({
        ...mailData,
        to: ["recipient1@example.com", "recipient2@example.com"],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["recipient1@example.com", "recipient2@example.com"],
        }),
      );
    });
  });
});

describe("ConsoleResend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize and log message", () => {
      const opts = { apiKey: "test-key", retryLimit: 3 };

      const r = new ConsoleResend(opts);

      expect(r.opts).toEqual(opts);
      expect(logger.debug).toHaveBeenCalledWith(
        "ConsoleResend initialized for development environment",
      );
    });
  });

  describe("sendMail", () => {
    it("should log mail data without sending", async () => {
      const r = new ConsoleResend({ apiKey: "test-key", retryLimit: 3 });

      await r.sendMail({
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>This is a test email with some content</p>",
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "ConsoleResend.sendMail called with data:",
        expect.objectContaining({
          to: "recipient@example.com",
          from: "noreply@mail.beancount.io",
          subject: "Test Subject",
          html: "<p>This is a test email with some content</p>",
        }),
      );
    });
  });
});
