"use server";

import { dockErrorMessage, maxDockCredentialBytes, saveDockCredential } from "./dock";

export async function connectDockFromFile(form: FormData) {
  const file = form.get("credential");
  if (!(file instanceof File) || file.size < 1 || file.size > maxDockCredentialBytes) {
    return { ok: false as const, error: "请选择不超过 16 KB 的 Dock 应用凭据文件。" };
  }
  try {
    await saveDockCredential(await file.text());
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: dockErrorMessage(error) };
  }
}
