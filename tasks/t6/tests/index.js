// Aggregator: lets 'node --test ./__grade__/' work. node:test CLI spawns the directory
// as the child entry; this file imports every test file so all tests run in that child.
import './g01_validators.test.mjs';
import './g02_orders.test.mjs';
import './g03_users.test.mjs';
