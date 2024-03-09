import { handler, prepareDataByServices } from "./job.mjs";

import exampleJSON from "./example.json";

describe("job", () => {
  test("return Cost Explorer results", async () => {
    const result = await handler({
      ScheduledTime: new Date().toISOString(),
    });

    expect(result).toBeUndefined();
  });

  test("prepareDataByServices", async () => {
    expect(prepareDataByServices(exampleJSON.ResultsByTime)).toMatchSnapshot();
  });
});
