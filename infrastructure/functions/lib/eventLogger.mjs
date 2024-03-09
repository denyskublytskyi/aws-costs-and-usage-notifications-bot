const eventLogger = (handler) => (event, context) => {
  console.log("Incoming event =>", JSON.stringify(event, null, 2));
  return handler(event, context);
};

export default eventLogger;
