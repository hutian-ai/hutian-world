"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  return <main className="error-page"><h1>暂时无法读取工作台</h1><p>请确认应用和数据库已启动，再重新加载。已有数据不会因此清空。</p><Button onClick={() => { reset(); router.refresh(); }}>重新加载</Button></main>;
}
