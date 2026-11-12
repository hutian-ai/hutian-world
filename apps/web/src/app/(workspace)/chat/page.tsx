import Link from "next/link";
import { DirectChat } from "@/components/direct-chat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { chatErrorMessage, getDirectChat } from "@/lib/direct-chat";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ peer?: string | string[] }> }) {
  const { peer } = await searchParams;
  try {
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
