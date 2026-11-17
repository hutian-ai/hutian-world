import Link from "@/lib/navigation";
import { Button } from "@hutian-ai/design/ui/button";
import { usePathname } from "@/lib/navigation";
import { workspaceSection } from "@/lib/workspace-navigation";
import { PageNavigation } from "@/components/page-navigation";
export default function NotFound() {
  const section = workspaceSection(usePathname());
  return (
    <main className="error-page">
      <PageNavigation
        items={[
          ...(section ? [{ label: section.label, href: section.href }] : []),
          { label: "页面不存在" },
        ]}
      />
      <h1>没有找到这个页面</h1>
      <p>页面可能已删除、地址有误或当前不可访问。</p>
      <Button asChild>
        <Link href={section?.href ?? "/chat"}>
          返回{section?.label ?? "沟通"}
        </Link>
      </Button>
    </main>
  );
}
