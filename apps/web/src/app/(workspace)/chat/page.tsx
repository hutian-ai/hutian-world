import Link from "@/lib/navigation";
import { DirectChat } from "@/components/direct-chat";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Button } from "@hutian-ai/design/ui/button";
import { chatErrorMessage, getDirectChat } from "@/lib/direct-chat";
import { Communications } from "@/components/communications";
import { readConversation, readDirectory } from "@/lib/communications";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{
    peer?: string | string[];
    room?: string | string[];
    role?: string | string[];
  }>;
}) {
  const { peer, room, role } = await searchParams;
  try {
    if (typeof peer !== "string") {
      const directory = await readDirectory();
      const selected = typeof room === "string" ? room : undefined;
      const initial = selected ? await readConversation(selected) : null;
      // Automatic work rooms stay out of the regular directory, but an existing
      // source link must still open the authorized original conversation.
      if (
        selected &&
        initial &&
        !directory.rooms.some((item) => item.id === selected)
      )
        directory.rooms.push({
          id: selected,
          name: initial.room.name,
          kind: "direct",
        });
      const preferredAgentId =
        typeof role === "string"
          ? initial?.agents.find((a) => a.roleId === role && a.joined)?.id
          : undefined;
      return (
        <Communications
          key={selected ?? "directory"}
          directory={directory}
          initial={initial}
          {...(selected ? { selectedId: selected } : {})}
          {...(preferredAgentId ? { preferredAgentId } : {})}
        />
      );
    }
    const chat = await getDirectChat(
      typeof peer === "string" ? peer : undefined,
    );
    return <DirectChat key={chat.selected?.id ?? "directory"} {...chat} />;
  } catch (error) {
    return (
      <div className="communication-page p-4">
        <Alert variant="destructive">
          <AlertDescription>{chatErrorMessage(error)}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" size="sm" className="mt-3 self-start">
          <Link href="/chat" prefetch={false}>
            重新打开私聊
          </Link>
        </Button>
      </div>
    );
  }
}
