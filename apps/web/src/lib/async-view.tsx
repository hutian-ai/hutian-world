import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import {
  useEffect,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";
export function useAsyncView(
  load: () => Promise<ReactNode>,
  dependencies: DependencyList,
) {
  const [result, setResult] = useState<{
    content?: ReactNode;
    error?: boolean;
  }>({});
  useEffect(() => {
    let active = true;
    setResult({});
    load().then(
      (content) => {
        if (active) setResult({ content });
      },
      () => {
        if (active) setResult({ error: true });
      },
    );
    return () => {
      active = false;
    };
  }, dependencies);
  if (result.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>内容暂不可读取，请稍后刷新。</AlertDescription>
      </Alert>
    );
  return (
    result.content ?? (
      <div className="p-4 text-sm text-muted-foreground" role="status">
        正在读取…
      </div>
    )
  );
}
