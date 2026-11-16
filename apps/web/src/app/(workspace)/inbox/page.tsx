import { getWorkspace } from "@/lib/api";
import { InboxWorkspace } from "@/components/inbox-workspace";
export default async function InboxPage() {
  const workspace = await getWorkspace();
  return <InboxWorkspace roles={workspace.roles} />;
}
