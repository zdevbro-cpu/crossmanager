const { onRequest } = require("firebase-functions/v2/https");
const app = require("./app");
const { setGlobalOptions } = require("firebase-functions/v2");

// Set global options (optional, but good practice)
setGlobalOptions({ region: "asia-northeast3" });

// Expose the API
exports.api = onRequest(app);
