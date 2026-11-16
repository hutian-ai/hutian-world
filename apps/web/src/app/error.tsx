"use client";
import { ApiError } from "@/lib/api";
import { Button } from "@hutian-ai/design/ui/button";
export class PageResourceError extends Error {}

export default function ErrorPage({
  reset,
  error,
}: {
  reset: () => void;
  error?: unknown;
}) {
  const resourceFailed = error instanceof PageResourceError;
  return (
    <div className="error-page">
      <h1>{resourceFailed ? "页面加载失败" : "暂时无法打开页面"}</h1>
      <p>
        {resourceFailed
          ? "页面文件未能加载，可能是页面刚刚更新。请重新加载以获取当前版本。"
          : error instanceof ApiError
            ? error.message
            : "当前页面暂不可读取，请重试并核对应用服务连接。"}
      </p>
      <Button
        onClick={() => {
          if (resourceFailed) window.location.reload();
          else reset();
        }}
      >
        {resourceFailed ? "重新加载页面" : "重试"}
      </Button>
    </div>
  );
}
