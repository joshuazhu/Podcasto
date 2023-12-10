import { SSTConfig } from "sst";
import { Core } from "./stacks/Core";

export default {
  config(_input) {
    return {
      name: "Podcasto",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(Core);
  }
} satisfies SSTConfig;
