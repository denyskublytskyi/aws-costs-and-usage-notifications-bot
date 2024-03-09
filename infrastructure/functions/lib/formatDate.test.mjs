import formatDate from "./formatDate.mjs";

describe("formatDate", () => {
  test("formats a date as YYYY-MM-DD", () => {
    expect(formatDate(new Date("2024-03-08"))).toBe("2024-03-08");
  });

  test("formats a date with timezone as YYYY-MM-DD", () => {
    expect(formatDate(new Date("2024-03-09T00:00:00.000+0500"))).toBe(
      "2024-03-08",
    );
  });

  test("throw an error when date is invalid", () => {
    expect(() => formatDate(new Date("test"))).toThrow(RangeError);
  });

  test("throw an error when date is not a date", () => {
    expect(() => formatDate("test")).toThrow(TypeError);
  });
});
