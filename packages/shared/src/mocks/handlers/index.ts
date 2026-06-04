/**
 * 전체 mock 핸들러 집계.
 */
import { nutToHandlers } from "./nut-to.js";
import { headsUpHandlers } from "./heads-up.js";
import { potQuizHandlers } from "./pot-quiz.js";
import { conceptQuizHandlers } from "./concept-quiz.js";
import { hubHandlers } from "./hub.js";

export const handlers = [
  ...nutToHandlers,
  ...headsUpHandlers,
  ...potQuizHandlers,
  ...conceptQuizHandlers,
  ...hubHandlers,
];
