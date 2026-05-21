import type { ArkBotClient } from "../client/ArkBotClient.js";

export interface ServiceContext {
  client: ArkBotClient;
}

export interface IService {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
