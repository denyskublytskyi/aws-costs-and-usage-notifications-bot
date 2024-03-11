import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import ms from "ms";
import compose from "lodash/fp/compose.js";
import fpFlatMapDepth from "lodash/fp/flatMapDepth.js";
import fpGroupBy from "lodash/fp/groupBy.js";
import fpMap from "lodash/fp/map.js";
import fpSumBy from "lodash/fp/sumBy.js";
import fpEntries from "lodash/fp/entries.js";
import fpOrderBy from "lodash/fp/orderBy.js";

import eventLogger from "./lib/eventLogger.mjs";
import formatDate from "./lib/formatDate.mjs";
// import exampleJSON from "./example.json" assert {type: "json"};
// import exampleJSON from "./example.json";
import sendNotification from "./lib/sendNotification.mjs";

const client = new CostExplorerClient();

const getCostAndUsage = async ({ startDate, endDate, granularity }) => {
  // return exampleJSON;
  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: formatDate(startDate),
      End: formatDate(endDate),
    },
    Granularity: granularity,
    Metrics: ["UnblendedCost", "UsageQuantity"],
    // Filter: {
    //   Tags: {
    //     Key: "Application",
    //     Values: ["uasystem-design"],
    //   },
    // },
    GroupBy: [
      {
        Type: "DIMENSION",
        Key: "SERVICE",
      },
    ],
  });
  return client.send(command);
};

export const prepareDataByServices = (data) => {
  return compose(
    fpOrderBy(["cost"], ["desc"]),
    fpMap(([service, entries]) => ({
      service,
      cost: fpSumBy("cost", entries),
      usage: fpSumBy("usage", entries),
    })),
    fpEntries,
    fpGroupBy("service"),
    fpFlatMapDepth(
      ({ Groups }) =>
        Groups.map(({ Keys, Metrics }) => ({
          service: Keys[0],
          cost: Math.abs(+Metrics.UnblendedCost.Amount),
          usage: Math.abs(+Metrics.UsageQuantity.Amount),
        })),
      1,
    ),
  )(data);
};

const getMessage = ({ data, title }) => {
  const totalCost = fpSumBy("cost", data);
  const byServicesMessage = data.map(
    ({ service, cost, usage }) =>
      `*${service}*\nCost: ${cost.toFixed(10)}$\nUsage: ${usage.toFixed(10)}`,
  );

  return [
    `**${title}** cost: ${totalCost.toFixed(10)}$`,
    ...byServicesMessage,
  ].join("\n\n");
};

const eventHandler = async ({ ScheduledTime }) => {
  const today = new Date(ScheduledTime);
  const yesterday = new Date(today - ms("1d"));
  const startOfTheMonth = new Date(today);
  startOfTheMonth.setDate(1);

  const response = await getCostAndUsage({
    startDate: startOfTheMonth,
    endDate: today,
    granularity: "DAILY",
  });

  const monthlyData = prepareDataByServices(response.ResultsByTime);
  const yesterdayData = prepareDataByServices(response.ResultsByTime.slice(-1));

  const monthTitle = today.toLocaleString("default", { month: "long" });
  const yesterdayTitle = yesterday.toLocaleDateString("en-GB", {
    month: "long",
    day: "numeric",
  });

  await Promise.all([
    sendNotification(
      getMessage({ data: yesterdayData, title: yesterdayTitle }),
    ),
    sendNotification(getMessage({ data: monthlyData, title: monthTitle })),
  ]);
};

export const handler = eventLogger(eventHandler);
