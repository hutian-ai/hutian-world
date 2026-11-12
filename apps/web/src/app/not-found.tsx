import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <main className="error-page"><h1>没有找到这个页面</h1><p>项目或角色可能不存在，请返回列表查看。</p><Button asChild><Link href="/projects">返回项目</Link></Button></main>; }
