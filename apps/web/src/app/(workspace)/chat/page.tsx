import Link from "next/link";
import { DirectChat } from "@/components/direct-chat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { chatErrorMessage, getDirectChat } from "@/lib/direct-chat";
import { Communications } from "@/components/communications";
import { readConversation, readDirectory } from "@/lib/communications";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ peer?: string | string[]; room?: string | string[]; role?: string | string[] }> }) {
  const { peer, room, role } = await searchParams;
  try {
    if (typeof peer !== "string") {
      const directory = await readDirectory();
      const selected = typeof room === "string" ? room : undefined;
      const initial = selected ? await readConversation(selected) : null;
      const preferredAgentId = typeof role === "string" ? initial?.agents.find(a => a.roleId === role && a.joined)?.id : undefined;
      return <Communications key={selected ?? "directory"} directory={directory} initial={initial} {...(selected?{selectedId:selected}:{})} {...(preferredAgentId?{preferredAgentId}:{})}/>;
    }
    const chat = await getDirectChat(typeof peer === "string" ? peer : undefined);
    return <DirectChat key={chat.selected?.id ?? "directory"} {...chat} />;
  } catch (error) {
    return (
      <div className="communication-page p-4">
        <Alert variant="destructive"><AlertDescription>{chatErrorMessage(error)}</AlertDescription></Alert>
        <Button asChild variant="outline" size="sm" className="mt-3 self-start"><Link href="/chat" prefetch={false}>重新打开私聊</Link></Button>
      </div>
    );
  }
}
