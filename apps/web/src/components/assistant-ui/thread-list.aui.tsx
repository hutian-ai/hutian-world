"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArchiveIcon,
  HashIcon,
  Loader2Icon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import {
  forwardRef,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type FC,
} from "react";

export type ThreadListComponents = {
  ThreadListItem?: ComponentType | undefined;
};

export type ThreadListProps = {
  remoteSearch?: { value: string; onValueChange: (value: string) => void };
  components?: ThreadListComponents | undefined;
  showNew?: boolean | undefined;
  onNew?: ComponentPropsWithoutRef<typeof Button>["onClick"];
  searchPlaceholder?: string | undefined;
  emptySearchLabel?: string | undefined;
  className?: string | undefined;
  searchClassName?: string | undefined;
  itemsClassName?: string | undefined;
  kindGroups?:
    | {
        onNewConversation: ComponentPropsWithoutRef<typeof Button>["onClick"];
        onNewChannel?: ComponentPropsWithoutRef<typeof Button>["onClick"];
      }
    | undefined;
};

export const ThreadList: FC<ThreadListProps> = ({
  components,
  remoteSearch,
  showNew = true,
  onNew,
  searchPlaceholder = "搜索会话",
  emptySearchLabel = "没有匹配的会话",
  className,
  searchClassName,
  itemsClassName,
  kindGroups,
}) => {
  const [search, setSearch] = useState("");
  const hasThreads = useAuiState((s) => s.threads.threadIds.length > 0);

  return (
    <ThreadListRoot className={className}>
      {showNew ? <ThreadListNew onClick={onNew} /> : null}
      {(hasThreads || remoteSearch) && (
        <ThreadListSearch
          value={remoteSearch?.value ?? search}
          onValueChange={remoteSearch?.onValueChange ?? setSearch}
          maxLength={300}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={searchClassName}
        />
      )}
      <ThreadListItems
        remoteFiltered={Boolean(remoteSearch)}
        searchQuery={remoteSearch ? remoteSearch.value : hasThreads ? search : ""}
        components={components}
        emptySearchLabel={emptySearchLabel}
        className={itemsClassName}
        kindGroups={kindGroups}
      />
    </ThreadListRoot>
  );
};

export const ThreadListSearch = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<typeof Input>, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string) => void;
  }
>(({ className, value, onValueChange, ...props }, ref) => {
  return (
    <div data-slot="aui_thread-list-search" className="relative px-0.5 py-1">
      <SearchIcon
        data-slot="aui_thread-list-search-icon"
        className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-label="搜索会话"
        placeholder="搜索会话"
        className={cn("h-8 ps-8 text-sm", className)}
        {...props}
      />
    </div>
  );
});

ThreadListSearch.displayName = "ThreadListSearch";

export const ThreadListRoot: FC<ComponentPropsWithoutRef<typeof ThreadListPrimitive.Root>> = ({
  className,
  ...props
}) => {
  return (
    <ThreadListPrimitive.Root
      data-slot="aui_thread-list-root"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  );
};

export const ThreadListItems: FC<
  ComponentPropsWithoutRef<"div"> & {
    searchQuery?: string;
    remoteFiltered?: boolean;
    components?: ThreadListComponents | undefined;
    emptySearchLabel?: string | undefined;
    kindGroups?: ThreadListProps["kindGroups"];
  }
> = ({
  className,
  searchQuery = "",
  remoteFiltered = false,
  components,
  emptySearchLabel = "没有匹配的会话",
  kindGroups,
  ...props
}) => {
  return (
    <div
      data-slot="aui_thread-list-items"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    >
      <AuiIf condition={(s) => s.threads.isLoading}>
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf condition={(s) => !s.threads.isLoading}>
        {kindGroups ? (
          <ThreadListKindGroups
            remoteFiltered={remoteFiltered}
            searchQuery={searchQuery}
            components={components}
            emptySearchLabel={emptySearchLabel}
            actions={kindGroups}
          />
        ) : (
          <ThreadListItemGroups
            searchQuery={searchQuery}
            components={components}
            emptySearchLabel={emptySearchLabel}
          />
        )}
      </AuiIf>
    </div>
  );
};

const ThreadListKindGroups: FC<{
  searchQuery?: string;
  remoteFiltered?: boolean;
  components?: ThreadListComponents | undefined;
  emptySearchLabel: string;
  actions: NonNullable<ThreadListProps["kindGroups"]>;
}> = ({ searchQuery = "", remoteFiltered = false, components, emptySearchLabel, actions }) => {
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const threadItems = useAuiState((s) => s.threads.threadItems);
  const query = searchQuery.trim().toLowerCase();
  const { channels, conversations } = useMemo(() => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    const filtered = threadIds
      .map((id, index) => ({ id, index, item: itemsById.get(id) }))
      .filter(
        ({ item }) =>
          remoteFiltered ||
          !query ||
          [
            item?.title || "未命名会话",
            typeof item?.custom?.searchText === "string" ? item.custom.searchText : "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) =>
        remoteFiltered
          ? a.index - b.index
          : (b.item?.lastMessageAt?.getTime() ?? 0) - (a.item?.lastMessageAt?.getTime() ?? 0),
      );
    return {
      channels: filtered.filter(({ item }) => item?.custom?.kind === "channel"),
      conversations: filtered.filter(({ item }) => item?.custom?.kind !== "channel"),
    };
  }, [query, remoteFiltered, threadIds, threadItems]);

  if (query && channels.length === 0 && conversations.length === 0) {
    return (
      <div data-slot="aui_thread-list-empty" className="text-muted-foreground px-2.5 py-4 text-sm">
        {emptySearchLabel}
      </div>
    );
  }

  const renderItems = (items: Array<{ id: string; index: number }>) =>
    items.map(({ id, index }) => (
      <ThreadListPrimitive.ItemByIndex
        key={id}
        index={index}
        components={{
          ThreadListItem: components?.ThreadListItem ?? ThreadListItem,
        }}
      />
    ));

  return (
    <>
      <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <HashIcon className="size-3.5" aria-hidden="true" />
          <span>频道</span>
          <span className="text-faint">
            {remoteFiltered ? "本页 " : ""}
            {channels.length}
          </span>
        </div>
        {actions.onNewChannel ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 md:size-8"
            onClick={actions.onNewChannel}
            aria-label="创建频道"
            title="创建频道"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {channels.length ? (
        renderItems(channels)
      ) : (
        <p className="text-faint px-2.5 py-2 text-xs">
          {remoteFiltered ? "本页没有频道" : "还没有频道"}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between border-t px-2.5 pt-3 pb-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <UsersIcon className="size-3.5" aria-hidden="true" />
          <span>会话</span>
          <span className="text-faint">
            {remoteFiltered ? "本页 " : ""}
            {conversations.length}
          </span>
        </div>
        <ThreadListNew
          onClick={actions.onNewConversation}
          className="size-11 justify-center p-0 md:size-8"
          aria-label="新建会话"
          title="新建会话"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </ThreadListNew>
      </div>
      {conversations.length ? (
        renderItems(conversations)
      ) : (
        <p className="text-faint px-2.5 py-2 text-xs">
          {remoteFiltered ? "本页没有会话" : "还没有会话"}
        </p>
      )}
    </>
  );
};

const DAY_IN_MS = 86_400_000;

const dateGroupLabel = (date: Date | undefined, startOfToday: number): string => {
  if (!date || date.getTime() >= startOfToday) return "今天";
  if (date.getTime() >= startOfToday - DAY_IN_MS) return "昨天";
  return "更早";
};

type ThreadListGroup = { label: string; indices: number[] };

const ThreadListItemGroups: FC<{
  searchQuery?: string;
  components?: ThreadListComponents | undefined;
  emptySearchLabel: string;
}> = ({ searchQuery = "", components, emptySearchLabel }) => {
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const threadItems = useAuiState((s) => s.threads.threadItems);

  const query = searchQuery.trim().toLowerCase();

  const { filteredIndices, groups } = useMemo(() => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    const dates = threadIds.map((id) => itemsById.get(id)?.lastMessageAt);
    const filteredIndices = threadIds
      .map((id, index) => ({ id, index }))
      .filter(
        ({ id }) =>
          !query ||
          [
            itemsById.get(id)?.title || "未命名会话",
            typeof itemsById.get(id)?.custom?.searchText === "string"
              ? itemsById.get(id)?.custom?.searchText
              : "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
      )
      .map(({ index }) => index);
    if (!filteredIndices.some((index) => dates[index])) {
      return { filteredIndices, groups: null };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const time = (index: number) => dates[index]?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const sorted = [...filteredIndices].sort((a, b) => time(b) - time(a));

    const result: ThreadListGroup[] = [];
    for (const index of sorted) {
      const label = dateGroupLabel(dates[index], startOfToday);
      const lastGroup = result[result.length - 1];
      if (lastGroup?.label === label) {
        lastGroup.indices.push(index);
      } else {
        result.push({ label, indices: [index] });
      }
    }
    return { filteredIndices, groups: result };
  }, [threadIds, threadItems, query]);

  if (query && filteredIndices.length === 0) {
    return (
      <div data-slot="aui_thread-list-empty" className="text-muted-foreground px-2.5 py-4 text-sm">
        {emptySearchLabel}
      </div>
    );
  }

  if (!groups) {
    return filteredIndices.map((index) => (
      <ThreadListPrimitive.ItemByIndex
        key={threadIds[index]}
        index={index}
        components={{
          ThreadListItem: components?.ThreadListItem ?? ThreadListItem,
        }}
      />
    ));
  }

  return groups.map((group) => (
    <Fragment key={group.label}>
      <div
        data-slot="aui_thread-list-group-label"
        className="text-muted-foreground px-2.5 pt-3 pb-1 text-xs font-medium"
      >
        {group.label}
      </div>
      {group.indices.map((index) => (
        <ThreadListPrimitive.ItemByIndex
          key={threadIds[index]}
          index={index}
          components={{
            ThreadListItem: components?.ThreadListItem ?? ThreadListItem,
          }}
        />
      ))}
    </Fragment>
  ));
};

export const ThreadListNew = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Button> & { labelClassName?: string }
>(({ className, labelClassName, children, onClick, ...props }, ref) => {
  return (
    <ThreadListPrimitive.New asChild onClick={onClick}>
      <Button
        ref={ref}
        variant="ghost"
        data-slot="aui_thread-list-new"
        className={cn(
          "hover:bg-muted data-active:bg-muted h-11 justify-start gap-2 rounded-md px-2.5 text-sm font-normal",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <PlusIcon data-slot="aui_thread-list-new-icon" className="size-4 shrink-0" />
            <span
              data-slot="aui_thread-list-new-label"
              className={cn("whitespace-nowrap", labelClassName)}
            >
              新会话
            </span>
          </>
        )}
      </Button>
    </ThreadListPrimitive.New>
  );
});

ThreadListNew.displayName = "ThreadListNew";

const ThreadListSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="正在加载会话"
          data-slot="aui_thread-list-skeleton-wrapper"
          className="flex h-8 items-center px-2.5"
        >
          <Skeleton data-slot="aui_thread-list-skeleton" className="h-3.5 w-full" />
        </div>
      ))}
    </div>
  );
};

export const ThreadListItem: FC = () => {
  const runtimeIsRunning = useAuiState((s) => s.threadListItem.isRunning);
  const lastMessageAt = useAuiState((s) => s.threadListItem.lastMessageAt);
  const custom = useAuiState((s) => s.threadListItem.custom);
  const [isRenaming, setIsRenaming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (isRenaming || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    triggerRef.current?.focus();
  }, [isRenaming]);

  const kind =
    custom?.kind === "channel"
      ? "channel"
      : custom?.kind === "session"
        ? "session"
        : custom?.kind === "group"
          ? "group"
          : "direct";
  const participantLabel =
    typeof custom?.participantLabel === "string" ? custom.participantLabel : "成员";
  const initial = typeof custom?.initial === "string" ? custom.initial : "会";
  const avatarUrl = typeof custom?.avatarUrl === "string" ? custom.avatarUrl : undefined;
  const messageCount = typeof custom?.messageCount === "number" ? custom.messageCount : 0;
  const unreadCount = typeof custom?.unreadCount === "number" ? custom.unreadCount : 0;
  const processingTurnCount =
    typeof custom?.processingTurnCount === "number" ? custom.processingTurnCount : 0;
  const isRunning = runtimeIsRunning || processingTurnCount > 0;
  const canManage = custom?.canManage === true;
  const projectLabels = Array.isArray(custom?.projectLabels)
    ? custom.projectLabels.filter(
        (label): label is string => typeof label === "string" && label.length > 0,
      )
    : [];
  const secondaryLabel =
    kind !== "channel" && projectLabels.length
      ? `${projectLabels.join("、")} · ${participantLabel}`
      : participantLabel;
  const activityLabel =
    typeof custom?.activityLabel === "string" ? custom.activityLabel :
    messageCount > 0 && lastMessageAt
      ? lastMessageAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : "新会话";

  return (
    <ThreadListItemPrimitive.Root
      data-slot="aui_thread-list-item"
      className="group hover:bg-muted focus-visible:bg-muted data-active:bg-muted has-focus-visible:bg-muted has-data-[state=open]:bg-muted relative flex min-h-16 items-center rounded-md transition-colors focus-visible:outline-none"
    >
      {isRenaming ? (
        <ThreadListItemRename
          onDone={(restoreFocus) => {
            restoreFocusRef.current = restoreFocus;
            setIsRenaming(false);
          }}
        />
      ) : (
        <ThreadListItemPrimitive.Trigger
          ref={triggerRef}
          data-slot="aui_thread-list-item-trigger"
          className="focus-visible:ring-ring/50 grid min-h-16 min-w-0 flex-1 grid-cols-[2.25rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-md px-2.5 py-2 text-start text-sm outline-none focus-visible:ring-1"
        >
          <span className="relative block size-9 shrink-0">
            {kind === "channel" ? (
              <span className="flex size-9 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                <HashIcon aria-hidden />
              </span>
            ) : kind === "session" ? (
              <span className="flex size-9 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                <MessageSquareIcon aria-hidden />
              </span>
            ) : kind === "group" ? (
              <span className="flex size-9 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                <UsersIcon aria-hidden />
              </span>
            ) : (
              <Avatar className="size-9 rounded-md">
                {avatarUrl ? (
                  <AvatarImage
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-md bg-primary/10 text-primary">
                  {initial}
                </AvatarFallback>
              </Avatar>
            )}
            {isRunning ? (
              <span
                data-slot="aui_thread-list-item-running"
                className="bg-background absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full border"
                title="成员正在处理"
              >
                <Loader2Icon
                  aria-hidden
                  className="size-2.5 animate-spin text-muted-foreground motion-reduce:animate-none"
                />
                <span className="sr-only">成员正在处理</span>
              </span>
            ) : null}
          </span>
          <span className="min-w-0">
            <span data-slot="aui_thread-list-item-title" className="block truncate font-medium">
              <ThreadListItemPrimitive.Title fallback="未命名会话" />
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {secondaryLabel}
            </span>
          </span>
          <span className="flex h-full min-w-0 flex-col items-end justify-start pt-0.5">
            {unreadCount > 0 ? (
              <Badge className="h-5 min-w-5 justify-center px-1.5 tabular-nums">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            ) : (
              <span className="shrink-0 text-[10px] leading-4 text-muted-foreground">
                {activityLabel}
              </span>
            )}
          </span>
          {isRunning && <span className="sr-only">执行中</span>}
        </ThreadListItemPrimitive.Trigger>
      )}
      {canManage ? <ThreadListItemMore onRename={() => setIsRenaming(true)} /> : null}
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemRename: FC<{
  onDone: (restoreFocus: boolean) => void;
}> = ({ onDone }) => {
  const aui = useAui();
  const title = useAuiState((s) => s.threadListItem.title) ?? "";
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const commit = (restoreFocus: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;

    const next = value.trim();
    if (!next || next === title) {
      onDone(restoreFocus);
      return;
    }

    // Deferred so a synchronous throw lands on the rejection path too.
    Promise.resolve()
      .then(() => aui.threadListItem.rename(next))
      .then(
        () => onDone(restoreFocus),
        () => {
          settledRef.current = false;
          if (restoreFocus) inputRef.current?.focus();
        },
      );
  };

  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onDone(true);
  };

  return (
    <Input
      ref={inputRef}
      autoFocus
      data-slot="aui_thread-list-item-rename"
      aria-label="重命名会话"
      value={value}
      className="h-10 min-w-0 flex-1 ps-2.5 pe-12 text-sm"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
};

const ThreadListItemMore: FC<{ onRename: () => void }> = ({ onRename }) => {
  return (
    <ThreadListItemMorePrimitive.Root sharedFocusGroup>
      <ThreadListItemMorePrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-slot="aui_thread-list-item-more"
          className="data-[state=open]:bg-accent absolute end-1 bottom-1 size-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 group-has-focus-visible:opacity-100 group-data-active:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontalIcon className="size-3.5" />
          <span className="sr-only">更多操作</span>
        </Button>
      </ThreadListItemMorePrimitive.Trigger>
      <ThreadListItemMorePrimitive.Content
        side="right"
        align="start"
        sideOffset={6}
        data-slot="aui_thread-list-item-more-content"
        className="bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-hidden rounded-lg border p-1.5 shadow-none"
      >
        <ThreadListItemMorePrimitive.Item
          data-slot="aui_thread-list-item-more-item"
          className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
          onSelect={onRename}
        >
          <PencilIcon className="size-4" />
          重命名
        </ThreadListItemMorePrimitive.Item>
        <ThreadListItemPrimitive.Archive asChild>
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
          >
            <ArchiveIcon className="size-4" />
            归档
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemPrimitive.Archive>
      </ThreadListItemMorePrimitive.Content>
    </ThreadListItemMorePrimitive.Root>
  );
};
