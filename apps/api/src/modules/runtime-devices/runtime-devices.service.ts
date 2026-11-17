import { loadClientOptions } from "@harness-dock/client";
import { type RuntimeDeviceNameInput } from "@hutian-world/contracts";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { DataSource, type EntityManager } from "typeorm";
import { appDataDirectory } from "../../config/paths.js";
import { AccessContexts } from "../access/access-context.service.js";
import { requireLocalConnection } from "../access/connection-access.js";
import { ModuleConnectionSchema } from "../access/entities/access.schema.js";
import { RuntimeDeviceSettingSchema } from "./entities/runtime-device-setting.schema.js";

@Injectable()
export class RuntimeDevicesService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  async source() {
    const access = await requireLocalConnection(
      { contexts: this.contexts },
      "dock",
    );
    const connectionId = access.connections.dock;
    if (!connectionId) throw new ForbiddenException("当前空间没有 Dock 连接。");
    const options = await loadClientOptions(
      resolve(appDataDirectory, "dock-client.json"),
    );
    // The current single-connection slot can import another server/application.
    // Keep names separate across replacements, but stable across token rotation.
    const sourceKey = createHash("sha256")
      .update(
        JSON.stringify([new URL(options.endpoint).href, options.clientId]),
      )
      .digest("hex");
    return { workspaceId: access.workspaceId, connectionId, sourceKey };
  }
  async list(manager: EntityManager = this.db.manager) {
    // Unavailable credentials must not hide members or lend another source's names.
    let source: Awaited<ReturnType<RuntimeDevicesService["source"]>>;
    try {
      source = await this.source();
    } catch {
      return { source: null, settings: [] };
    }
    return {
      source,
      settings: await manager
        .getRepository(RuntimeDeviceSettingSchema)
        .findBy(source),
    };
  }
  async save(input: RuntimeDeviceNameInput) {
    const access = this.contexts.current();
    if (access.membershipRole !== "owner")
      throw new ForbiddenException("只有管理者可以修改设备名称。");
    return this.db.transaction(async (manager) => {
      const connection = await manager
        .getRepository(ModuleConnectionSchema)
        .findOne({
          where: {
            id: input.connectionId,
            workspaceId: access.workspaceId,
            ownerUserId: access.userId,
            kind: "dock",
          },
          lock: { mode: "pessimistic_write" },
        });
      if (!connection) throw new ForbiddenException("设备连接不属于当前空间。");
      const source = await this.source();
      if (
        source.connectionId !== input.connectionId ||
        source.sourceKey !== input.sourceKey
      )
        throw new ConflictException("设备连接已更换，请刷新后重新修改名称。");
      const repository = manager.getRepository(RuntimeDeviceSettingSchema);
      const key = { ...source, nodeId: input.nodeId };
      const current = await repository.findOneBy(key);
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          "名称已在其他页面修改，请刷新后核对最新名称。",
        );
      const saved = await repository.save({
        ...key,
        customName: input.customName,
        version: (current?.version ?? 0) + 1,
        updatedBy: access.userId,
      });
      return { customName: saved.customName, version: saved.version };
    });
  }
}
