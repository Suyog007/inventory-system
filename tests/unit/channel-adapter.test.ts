import { describe, it, expectTypeOf } from "vitest";
import type {
  ChannelAdapter,
  ChannelListingSnapshot,
  ChannelUpsertInput,
  ChannelUpsertResult,
  WebhookVerification,
  ParsedWebhook,
} from "@/lib/channels/_adapter";

// Type-level tests. If the ChannelAdapter interface changes incompatibly,
// these will fail to compile and the test will fail at TypeScript step.
describe("ChannelAdapter interface contract", () => {
  it("requires the five core methods", () => {
    expectTypeOf<ChannelAdapter>().toHaveProperty("channel");
    expectTypeOf<ChannelAdapter>().toHaveProperty("importCatalog");
    expectTypeOf<ChannelAdapter>().toHaveProperty("pushUpsert");
    expectTypeOf<ChannelAdapter>().toHaveProperty("pushDelete");
    expectTypeOf<ChannelAdapter>().toHaveProperty("verifyWebhook");
    expectTypeOf<ChannelAdapter>().toHaveProperty("handleWebhook");
  });

  it("pushUpsert takes ChannelUpsertInput and returns Promise<ChannelUpsertResult>", () => {
    expectTypeOf<ChannelAdapter["pushUpsert"]>().parameters.toEqualTypeOf<
      [ChannelUpsertInput]
    >();
    expectTypeOf<ChannelAdapter["pushUpsert"]>().returns.toEqualTypeOf<
      Promise<ChannelUpsertResult>
    >();
  });

  it("pushDelete takes a string externalId and returns Promise<void>", () => {
    expectTypeOf<ChannelAdapter["pushDelete"]>().parameters.toEqualTypeOf<
      [string]
    >();
    expectTypeOf<ChannelAdapter["pushDelete"]>().returns.toEqualTypeOf<
      Promise<void>
    >();
  });

  it("verifyWebhook returns WebhookVerification", () => {
    expectTypeOf<ChannelAdapter["verifyWebhook"]>().returns.toEqualTypeOf<
      WebhookVerification
    >();
  });

  it("handleWebhook returns ParsedWebhook", () => {
    expectTypeOf<ChannelAdapter["handleWebhook"]>().returns.toEqualTypeOf<
      ParsedWebhook
    >();
  });

  it("importCatalog returns an AsyncIterable of ChannelListingSnapshot", () => {
    expectTypeOf<
      ReturnType<ChannelAdapter["importCatalog"]>
    >().toEqualTypeOf<AsyncIterable<ChannelListingSnapshot>>();
  });
});
