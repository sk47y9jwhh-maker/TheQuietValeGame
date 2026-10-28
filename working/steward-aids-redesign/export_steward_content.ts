import { coreTiles } from "../../src/data/tiles";
import { stewards } from "../../src/data/stewards";

process.stdout.write(JSON.stringify({ coreTiles, stewards }));
