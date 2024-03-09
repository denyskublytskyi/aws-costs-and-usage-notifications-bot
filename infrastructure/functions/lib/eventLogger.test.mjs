import { jest } from "@jest/globals";
import eventLogger from "./eventLogger.mjs";

describe("eventLogger", () => {
  test("logger is called", () => {
    const event = { key1: "value1" };
    const context = { key2: "value2" };
    const result = {
      key3: "value3",
    };

    const handler = jest.fn().mockReturnValue(result);
    console.log = jest.fn();
    const logger = eventLogger(handler);

    expect(logger(event, context)).toBe(result);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event, context);
    expect(console.log).toHaveBeenCalledTimes(1);
  });
});
